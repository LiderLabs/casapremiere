// Change your own password.
//
// Requires the current password, applies the shared policy, refuses to re-set the same
// password, and revokes every *other* session - so an old laptop that was left signed in
// stops working the moment the password changes. The session making the change survives.

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertSameOrigin,
  checkPasswordPolicy,
  hashPassword,
  PASSWORD_MIN_LENGTH,
  requireApiUser,
  revokeUserSessions,
  verifyPassword,
} from "@/lib/admin/auth";
import { writeAudit } from "@/lib/cms/audit";
import { getDb } from "@/lib/cms/db";
import { users } from "@/lib/cms/schema";

export const dynamic = "force-dynamic";

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(256),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const auth = await requireApiUser({ allowPendingPasswordChange: true });
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = changeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await verifyPassword(row.passwordHash, parsed.data.currentPassword))) {
    await writeAudit({
      actor: user.username,
      action: "auth.password_change_failed",
      entity: "user",
      entityId: user.username,
      payload: { reason: "bad_current_password" },
    });
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const policy = checkPasswordPolicy(parsed.data.newPassword, {
    username: row.username,
    name: row.name,
  });
  if (!policy.ok) return NextResponse.json({ error: policy.message }, { status: 400 });

  if (await verifyPassword(row.passwordHash, parsed.data.newPassword)) {
    return NextResponse.json(
      { error: "That is your current password. Choose a different one." },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
      updatedBy: row.username,
    })
    .where(eq(users.id, row.id));

  await revokeUserSessions(row.id, user.sessionTokenHash);

  await writeAudit({
    actor: user.username,
    action: "auth.password_change",
    entity: "user",
    entityId: user.username,
  });

  return NextResponse.json({ ok: true, redirectTo: "/admin" });
}
