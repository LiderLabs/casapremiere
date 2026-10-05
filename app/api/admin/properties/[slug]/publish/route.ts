// Going live (docs/cms.md D6, Section 6, Section 7.2).
//
// `published = 1` plus *who* and *when*, then the public routes' caches are revalidated — so the
// change is on `/`, `/properties` and `/interior` in seconds, with no commit and no redeploy.
//
// The body is optional and carries placement only: `{ showOnHome, showOnListing }` publishes the
// home *and* puts it where the admin said. This is the one writer for destinations, so a home that
// is already live can be moved between surfaces without `updated_at` moving and a false "Pending"
// badge appearing on the list. The audit row is written by `setPublished`; this route owns the
// cache side because that is a Next concern.
// Editors may publish (D9); only the ability to delete or reorder is admin-only.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { setPublished } from "@/lib/cms/queries";
import { PUBLISHED_PATHS, revalidatePublishedPages } from "@/lib/cms/revalidate";
import { fieldErrors, firstIssueMessage, publishPropertySchema } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { slug } = await params;

  // The list's plain Publish button sends no body at all, which is exactly the "leave placement
  // where it is" case — so a missing or unparsable body is an empty placement, not a 400.
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = publishPropertySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const property = await setPublished(slug, true, auth.user, parsed.data);

    revalidatePublishedPages();

    return NextResponse.json({ property, revalidated: [...PUBLISHED_PATHS] });
  } catch (error) {
    return errorResponse(error, "Could not publish the property.");
  }
}
