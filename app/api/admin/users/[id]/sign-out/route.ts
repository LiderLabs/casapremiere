// "Sign out everywhere" for one user: revokes every live session without changing the
// password. The everyday use is a lost laptop — the account keeps working, the copied cookie
// stops working immediately.

import { NextResponse } from "next/server";

import { assertSameOrigin, requireApiUser } from "@/lib/admin/auth";
import { signOutEverywhere } from "@/lib/admin/users";
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
    const sessionsRevoked = await signOutEverywhere(id, auth.user);
    return NextResponse.json({ ok: true, sessionsRevoked });
  } catch (error) {
    return errorResponse(error, "Could not end that user's sessions.");
  }
}
