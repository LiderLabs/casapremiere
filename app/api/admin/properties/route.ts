// The catalogue for the admin list: every property, drafts included, flagged when a live one
// has been edited since its last publish (`pendingChanges`) — docs/cms.md Section 6, Section 7.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { errorResponse } from "@/lib/cms/errors";
import { createProperty, listProperties } from "@/lib/cms/queries";
import { createPropertySchema, fieldErrors, firstIssueMessage } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  return NextResponse.json({ properties: await listProperties() });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;

  const parsed = createPropertySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      { property: await createProperty(parsed.data, auth.user) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "Could not create the property.");
  }
}
