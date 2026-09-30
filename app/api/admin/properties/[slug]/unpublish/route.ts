// Coming back down: the everyday undo. `published_at`/`published_by` stay untouched, so the list
// keeps showing *when it was last live* — unlike delete, which leaves only an audit row behind.
// Editors may unpublish (D9); revalidation puts the change on the sites in seconds.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { setPublished } from "@/lib/cms/queries";
import { PUBLISHED_PATHS, revalidatePublishedPages } from "@/lib/cms/revalidate";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const { slug } = await params;

  try {
    const property = await setPublished(slug, false, auth.user);

    revalidatePublishedPages();

    return NextResponse.json({ property, revalidated: [...PUBLISHED_PATHS] });
  } catch (error) {
    return errorResponse(error, "Could not unpublish the property.");
  }
}
