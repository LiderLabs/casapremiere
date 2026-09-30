// Going live (docs/cms-build-spec.md D6, §6).
//
// `published = 1` plus *who* and *when*, then the two routes' caches are revalidated — so the
// change is on `/` and `/interior` in seconds, with no commit and no redeploy. The audit row is
// written by `setPublished`; this route owns the cache side because that is a Next concern.
// Editors may publish (D9); only the ability to delete or reorder is admin-only.

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
    const property = await setPublished(slug, true, auth.user);

    revalidatePublishedPages();

    return NextResponse.json({ property, revalidated: [...PUBLISHED_PATHS] });
  } catch (error) {
    return errorResponse(error, "Could not publish the property.");
  }
}
