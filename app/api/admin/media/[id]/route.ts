// One image's role or alt text (docs/cms-build-spec.md §8). Editors may edit; card stays
// single via lib/cms/queries.ts, where the demotion lives next to every other media rule.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { deleteMediaRow, updateMedia } from "@/lib/cms/queries";
import { deleteObject } from "@/lib/cms/r2";
import { revalidatePublishedPages } from "@/lib/cms/revalidate";
import { fieldErrors, firstIssueMessage, updateMediaSchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

/** Next 16 hands route params in as a promise. */
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;

  const parsed = updateMediaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const media = await updateMedia(id, parsed.data, auth.user);
    // Role and alt text decide which image is the card, and what a screen reader announces,
    // so a media edit is a public change (D6).
    revalidatePublishedPages();
    return NextResponse.json({ media });
  } catch (error) {
    return errorResponse(error, "Could not update the image.");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;

  try {
    const { r2Key } = await deleteMediaRow(id, auth.user);
    // Best-effort: the row is gone; an R2 miss must not fail the delete.
    if (!r2Key.startsWith("/")) await deleteObject(r2Key);
    // A removed card or gallery shot changes the grid and the drawer (D6).
    revalidatePublishedPages();
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return errorResponse(error, "Could not delete the image.");
  }
}
