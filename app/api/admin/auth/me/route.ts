// Who am I? Used by the admin UI and by any future client-side check.
//
// `allowPendingPasswordChange` is what lets the password screen work for a user who is
// signed in but has not chosen a password yet.

import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireApiUser({ allowPendingPasswordChange: true });
  if ("response" in result) return result.response;

  const { user } = result;

  return NextResponse.json({
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
