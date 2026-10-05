// User administration — the server half of `/admin/users` (docs/cms.md Section 5.5, Section 7).
//
// Three invariants live here rather than in the route handlers, so no future caller can
// forget them:
//
// 1. **The admin can never be locked out of itself.** The last *active* admin cannot be
//    disabled or demoted, however the request arrives.
// 2. **An admin cannot disable or demote themselves.** The guard above only covers the last
//    admin; a second admin switching their own account off is a support call nobody needs.
// 3. **Every credential change revokes sessions.** Resetting a password, disabling an account
//    and "sign out everywhere" all kill that user's live sessions in the same request,
//    because immediate revocation is the whole reason sessions live in a table.
//
// Server-only: it imports the auth core (cookies) and writes audit rows.

import { randomInt, randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull, or } from "drizzle-orm";

import { revokeUserSessions, type SessionUser } from "@/lib/admin/auth";
import { checkPasswordPolicy, hashPassword, normalizeUsername } from "@/lib/admin/password";
import { writeAudit } from "@/lib/cms/audit";
import { getDb } from "@/lib/cms/db";
import { CmsError } from "@/lib/cms/errors";
import { sessions, users, type UserRole, type UserStatus } from "@/lib/cms/schema";
import type { CreateUserInput, UpdateUserInput } from "@/lib/cms/validation";

/** What `/api/admin/users` returns: everything the list needs, and never a hash or a token. */
export type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  /** ISO timestamp while a lockout is in force, otherwise null. */
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** Live (unrevoked) sessions — exactly what "sign out everywhere" would end. */
  activeSessions: number;
};

/** An expected failure carrying the status the API should answer with. */
export class UserAdminError extends CmsError {
  constructor(message: string, status: number = 400) {
    super(message, status);
    this.name = "UserAdminError";
  }
}

/**
 * A temporary password that satisfies the same policy a person is held to: 20 characters from
 * an alphabet with no look-alikes (no l/1/I, no o/0/O), grouped for reading over the phone.
 * Regenerated on the off-chance it contains the username or the display name.
 */
const TEMP_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(context: { username: string; name?: string }): string {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const groups = Array.from({ length: 4 }, () =>
      Array.from({ length: 5 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join(""),
    );
    const candidate = groups.join("-");
    if (checkPasswordPolicy(candidate, context).ok) return candidate;
  }

  // 20 characters from a 56-character alphabet cannot realistically collide with a name; this
  // exists so the function is total rather than silently returning something weaker.
  throw new Error("Could not generate a temporary password.");
}

const nowIso = () => new Date().toISOString();

/** The list columns, shared by `listUsers` and the single-row reads so they cannot drift. */
const userColumns = {
  id: users.id,
  username: users.username,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  mustChangePassword: users.mustChangePassword,
  lockedUntil: users.lockedUntil,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  activeSessions: count(sessions.tokenHash).mapWith(Number),
};

/** Everyone, oldest first, with a live session count — the `/admin/users` list. */
export async function listUsers(): Promise<AdminUser[]> {
  return getDb()
    .select(userColumns)
    .from(users)
    .leftJoin(sessions, and(eq(sessions.userId, users.id), isNull(sessions.revokedAt)))
    .groupBy(users.id)
    .orderBy(asc(users.createdAt));
}

async function findUser(id: string): Promise<AdminUser | undefined> {
  const [row] = await getDb()
    .select(userColumns)
    .from(users)
    .leftJoin(sessions, and(eq(sessions.userId, users.id), isNull(sessions.revokedAt)))
    .where(eq(users.id, id))
    .groupBy(users.id)
    .limit(1);

  return row;
}

export async function countActiveAdmins(): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));

  return Number(row?.total ?? 0);
}

/**
 * The invariant: at least one active admin must remain. Only a *real* change to a currently
 * active admin is checked, so renaming one is never blocked.
 */
async function assertAdminRemains(
  targetUserId: string,
  next: { role?: UserRole; status?: UserStatus },
): Promise<void> {
  const removingAdmin = next.role !== undefined && next.role !== "admin";
  const disabling = next.status === "disabled";
  if (!removingAdmin && !disabling) return;

  const [target] = await getDb()
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target || target.role !== "admin" || target.status !== "active") return;

  if ((await countActiveAdmins()) <= 1) {
    throw new UserAdminError(
      "That is the last active admin. Create or promote another admin first.",
      409,
    );
  }
}

/** A temporary password plus the row it was written to; the plaintext is returned exactly once. */
export type CreatedUser = { user: AdminUser; temporaryPassword: string };

export async function createUser(
  input: CreateUserInput,
  actor: SessionUser,
): Promise<CreatedUser> {
  const db = getDb();
  const username = normalizeUsername(input.username);
  const email = input.email ?? null;

  const [clash] = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(
      email
        ? or(eq(users.username, username), eq(users.email, email))
        : eq(users.username, username),
    )
    .limit(1);

  if (clash) {
    throw new UserAdminError(
      clash.username === username
        ? `"${username}" already exists. Reset that password instead.`
        : "That email address is already in use.",
      409,
    );
  }

  // A generated password is already policy-checked; one the caller typed is not.
  const temporaryPassword =
    input.tempPassword ?? generateTemporaryPassword({ username, name: input.name });

  if (input.tempPassword) {
    const policy = checkPasswordPolicy(input.tempPassword, { username, name: input.name });
    if (!policy.ok) throw new UserAdminError(policy.message);
  }

  const now = nowIso();
  const id = randomUUID();

  await db.insert(users).values({
    id,
    username,
    email,
    name: input.name,
    role: input.role,
    passwordHash: await hashPassword(temporaryPassword),
    // Always: a password an admin chose is not a password the user has chosen.
    mustChangePassword: true,
    status: "active",
    createdAt: now,
    createdBy: actor.username,
    updatedAt: now,
    updatedBy: actor.username,
  });

  await writeAudit({
    actor: actor.username,
    action: "user.create",
    entity: "user",
    entityId: username,
    payload: { role: input.role, generatedPassword: input.tempPassword === undefined },
  });

  const user = await findUser(id);
  if (!user) throw new UserAdminError("The user was created but could not be read back.", 500);

  return { user, temporaryPassword };
}

export async function updateUser(
  id: string,
  patch: UpdateUserInput,
  actor: SessionUser,
): Promise<AdminUser> {
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new UserAdminError("No such user.", 404);

  // Only real changes reach the database or the audit row - a no-op save is not an event.
  const changes: { name?: string; role?: UserRole; status?: UserStatus } = {};
  if (patch.name !== undefined && patch.name !== target.name) changes.name = patch.name;
  if (patch.role !== undefined && patch.role !== target.role) changes.role = patch.role;
  if (patch.status !== undefined && patch.status !== target.status) changes.status = patch.status;

  if (Object.keys(changes).length === 0) throw new UserAdminError("Nothing to update.");

  if (target.id === actor.id) {
    if (changes.status === "disabled") {
      throw new UserAdminError("You cannot disable your own account. Ask another admin to do it.");
    }
    if (changes.role !== undefined) {
      throw new UserAdminError("You cannot change your own role. Ask another admin to do it.");
    }
  }

  await assertAdminRemains(target.id, changes);

  await db
    .update(users)
    .set({ ...changes, updatedAt: nowIso(), updatedBy: actor.username })
    .where(eq(users.id, target.id));

  // A disabled or demoted user must stop working *now*, not when their session expires.
  if (changes.status === "disabled" || changes.role !== undefined) {
    await revokeUserSessions(target.id);
  }

  await writeAudit({
    actor: actor.username,
    action:
      changes.status === "disabled"
        ? "user.disable"
        : changes.status === "active"
          ? "user.enable"
          : "user.update",
    entity: "user",
    entityId: target.username,
    payload: { changes },
  });

  const user = await findUser(target.id);
  if (!user) throw new UserAdminError("No such user.", 404);

  return user;
}

export type PasswordReset = { user: AdminUser; temporaryPassword: string; sessionsRevoked: number };

/**
 * Sets a temporary password the admin reads to the user once, unlocks the account (a reset is
 * also the way out of a lockout) and signs that user out everywhere.
 */
export async function resetUserPassword(id: string, actor: SessionUser): Promise<PasswordReset> {
  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new UserAdminError("No such user.", 404);

  const temporaryPassword = generateTemporaryPassword({
    username: target.username,
    name: target.name,
  });

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: nowIso(),
      updatedBy: actor.username,
    })
    .where(eq(users.id, target.id));

  const sessionsRevoked = await revokeUserSessions(target.id);

  await writeAudit({
    actor: actor.username,
    action: "user.reset_password",
    entity: "user",
    entityId: target.username,
    payload: { sessionsRevoked },
  });

  const user = await findUser(target.id);
  if (!user) throw new UserAdminError("No such user.", 404);

  return { user, temporaryPassword, sessionsRevoked };
}

/** "Sign out everywhere": ends every live session without touching the password. */
export async function signOutEverywhere(id: string, actor: SessionUser): Promise<number> {
  const [target] = await getDb()
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!target) throw new UserAdminError("No such user.", 404);

  const sessionsRevoked = await revokeUserSessions(target.id);

  await writeAudit({
    actor: actor.username,
    action: "user.sign_out_all",
    entity: "user",
    entityId: target.username,
    payload: { sessionsRevoked },
  });

  return sessionsRevoked;
}
