// Records one uploaded image after the browser PUTs it to R2 (docs/cms.md Section 8).
// Editors may confirm; the key must live under the slug's own prefix so one property cannot
// claim another's bytes.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { isR2Configured } from "@/lib/cms/env";
import { confirmMedia, getProperty } from "@/lib/cms/queries";
import { revalidatePublishedPages } from "@/lib/cms/revalidate";
import { confirmMediaSchema, fieldErrors, firstIssueMessage } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Image uploads are not configured yet. Add the R2 values to the environment." },
      { status: 503 },
    );
  }

  const parsed = confirmMediaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const slug = parsed.data.key.split("/")[1] ?? "";
  if (!(await getProperty(slug))) {
    return NextResponse.json({ error: `No property with the slug "${slug}".` }, { status: 404 });
  }

  try {
    const media = await confirmMedia(
      slug,
      {
        key: parsed.data.key,
        role: parsed.data.role,
        alt: parsed.data.alt,
        width: parsed.data.width,
        height: parsed.data.height,
        bytes: parsed.data.bytes,
      },
      auth.user,
    );
    // A new card or gallery image is visible on both sites as soon as it is confirmed (D6).
    revalidatePublishedPages();
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not record the upload.");
  }
}
