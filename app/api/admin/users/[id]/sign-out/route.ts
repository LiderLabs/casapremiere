// "Sign out everywhere" for one user: revokes every live session without changing the
// password. The everyday use is a lost laptop — the account keeps working, the copied cookie
// stops working immediately.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { UserAdminError, signOutEverywhere } from "@/lib/admin/users";

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
    const sessionsRevoked = await signOutEverywhere(id, auth.user);
    return NextResponse.json({ ok: true, sessionsRevoked });
  } catch (error) {
    if (error instanceof UserAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[cms] sign out everywhere failed:", error);
    return NextResponse.json({ error: "Could not end that user's sessions." }, { status: 500 });
  }
}
