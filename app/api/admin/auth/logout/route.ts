// Sign-out: revoke this session in the database, then clear the cookie. Revoking server-side
// (rather than only expiring the cookie) is what makes a copied cookie useless after logout.

import { NextResponse } from "next/server";

import {
  getSessionToken,
  getSessionUser,
  revokeSessionByToken,
  sessionCookieOptions,
} from "@/lib/admin/auth";
import { writeAudit } from "@/lib/cms/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = await getSessionToken();
  const user = token ? await getSessionUser() : undefined;

  if (token) await revokeSessionByToken(token);

  if (user) {
    await writeAudit({
      actor: user.username,
      action: "auth.logout",
      entity: "user",
      entityId: user.username,
    });
  }

  // maxAge 0 on the same path is what actually removes it from the browser.
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...sessionCookieOptions(0), value: "" });

  return response;
}

