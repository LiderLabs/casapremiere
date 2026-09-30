// The drag handle's write: the complete catalogue in its new order, rewritten as one batch
// (docs/cms-build-spec.md §6). Admin-only — open question 1 in §15 may move this to editors,
// and it would be this one `requireApiUser` call that changes.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { reorderProperties } from "@/lib/cms/queries";
import { revalidatePublishedPages } from "@/lib/cms/revalidate";
import {
  fieldErrors,
  firstIssueMessage,
  reorderPropertiesSchema,
} from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const parsed = reorderPropertiesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const properties = await reorderProperties(parsed.data.slugs, auth.user);
    // The new order *is* the grid order on both sites (D6).
    revalidatePublishedPages();
    return NextResponse.json({ properties });
  } catch (error) {
    return errorResponse(error, "Could not reorder the properties.");
  }
}
