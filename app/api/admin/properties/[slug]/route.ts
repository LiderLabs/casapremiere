// One property: partial save with an `updatedAt` precondition (409 names the other editor),
// and the delete action (admin-only, audit keeps the JSON) — docs/cms-build-spec.md §6.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { deleteProperty, getProperty, updateProperty } from "@/lib/cms/queries";
import { deleteObject } from "@/lib/cms/r2";
import { revalidatePublishedPages } from "@/lib/cms/revalidate";
import { fieldErrors, firstIssueMessage, updatePropertySchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

/** Next 16 hands route params in as a promise. */
type Context = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { slug } = await params;

  // The resource is answered before the payload: an edit aimed at a deleted or mistyped slug
  // must say so (404), rather than complain about the shape of the body (400).
  if (!(await getProperty(slug))) {
    return NextResponse.json({ error: `No property with the slug "${slug}".` }, { status: 404 });
  }

  // The slug is the `?property=` deep link and the interior site's card. A rename would break
  // shared URLs — so it is checked against the raw body first, where it always fires, rather
  // than after validation, where a body with only `updatedAt` and `slug` would read as
  // "nothing to update" and mask the real refusal.
  const body: unknown = await request.json().catch(() => null);

  if (
    body !== null &&
    typeof body === "object" &&
    "slug" in body &&
    typeof (body as { slug?: unknown }).slug === "string" &&
    (body as { slug: string }).slug !== slug
  ) {
    return NextResponse.json(
      {
        error:
          "The property address is permanent — it is the shared ?property= link. Change the name instead.",
      },
      { status: 400 },
    );
  }

  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const property = await updateProperty(slug, parsed.data, auth.user);
    // A save on a live home is a change to a live page, so the same two routes a publish
    // refreshes are refreshed here too (docs/cms-build-spec.md D6).
    revalidatePublishedPages();
    return NextResponse.json({ property });
  } catch (error) {
    return errorResponse(error, "Could not save the property.");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const { slug } = await params;

  try {
    const { mediaRemoved, r2Keys } = await deleteProperty(slug, auth.user);
    // Best-effort: the rows are gone; an R2 miss must not fail the delete.
    await Promise.all(r2Keys.filter((key) => !key.startsWith("/")).map((key) => deleteObject(key)));
    // A home that has just left the catalogue must leave the grid too (D6).
    revalidatePublishedPages();
    return NextResponse.json({ ok: true, slug, mediaRemoved });
  } catch (error) {
    return errorResponse(error, "Could not delete the property.");
  }
}
