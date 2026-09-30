// The user list and user creation (docs/cms-build-spec.md §5.5). Admin-only, and the only
// place a temporary password is ever returned — once, in the response that created it.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { createUser, listUsers } from "@/lib/admin/users";
import { errorResponse } from "@/lib/cms/errors";
import { createUserSchema, fieldErrors, firstIssueMessage } from "@/lib/cms/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  // No password_hash, no session token: the select list in lib/admin/users.ts decides what
  // leaves the server, so a future column cannot leak by accident.
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error), fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const { user, temporaryPassword } = await createUser(parsed.data, auth.user);
    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Could not create the user.");
  }
}
