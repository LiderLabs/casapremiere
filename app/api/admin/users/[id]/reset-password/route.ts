// Reset a user's password (spec §5.5): sets a temporary password, forces a change at the next
// sign-in, clears any lockout and signs that user out everywhere.
//
// The temporary password is generated on the server and appears in this response and nowhere
// else — no email provider is configured, so the admin reads it to the user once. It is never
// logged, never audited and never recoverable afterwards.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { resetUserPassword } from "@/lib/admin/users";
import { errorResponse } from "@/lib/cms/errors";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ role: "admin" });
  if ("response" in auth) return auth.response;

  const { id } = await params;

  try {
    const { user, temporaryPassword, sessionsRevoked } = await resetUserPassword(id, auth.user);
    return NextResponse.json({ user, temporaryPassword, sessionsRevoked });
  } catch (error) {
    return errorResponse(error, "Could not reset the password.");
  }
}
