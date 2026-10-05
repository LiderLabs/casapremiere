// Admin authentication: password hashing, database-backed sessions, roles and throttling.
//
// Design notes live in docs/cms.md Section 5. In short:
//
// - Sessions are opaque random tokens; only sha256(token) is stored, so a dump of the
//   sessions table cannot be replayed, and revocation is immediate (a JWT would leave a
//   disabled user signed in until it expired).
// - Passwords are argon2id. An unknown username is still verified against a throwaway hash,
//   so "no such user" and "wrong password" cost the same and cannot be told apart.
// - Server-only: no client component may import this module.

import { randomBytes } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  burnDummyPasswordCheck,
  checkPasswordPolicy,
  hashPassword,
  normalizeUsername,
  PASSWORD_MIN_LENGTH,
  sha256,
  verifyPassword,
} from "@/lib/admin/password";
import { SESSION_COOKIE } from "@/lib/admin/session-cookie";
import { getDb } from "@/lib/cms/db";
import { getEnv } from "@/lib/cms/env";
import { rateLimits, sessions, users, type UserRole } from "@/lib/cms/schema";

// The pure half (hashing, policy) lives in lib/admin/password.ts so the CLI scripts can use
// it without pulling in the request layer. Re-exported here so callers need one import.
export {
  burnDummyPasswordCheck,
  checkPasswordPolicy,
  hashPassword,
  normalizeUsername,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
};

export { SESSION_COOKIE } from "@/lib/admin/session-cookie";

export const MAX_FAILED_ATTEMPTS = 5;

/**
 * How long five wrong passwords lock an account for. Five minutes, not fifteen: long enough to
 * make guessing useless, short enough that a person who mistyped under pressure is not locked out
 * of their own site for a coffee break. The username rate-limit window in
 * app/api/admin/auth/login/route.ts is deliberately the same length, so the lock and the counter
 * that triggered it expire together.
 */
export const LOCKOUT_MINUTES = 5;

const SESSION_TOUCH_MINUTES = 5;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
  /** sha256 of the current cookie value, so a password change can revoke every *other* session. */
  sessionTokenHash: string;
};

const nowIso = () => new Date().toISOString();
const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  /** How many attempts have been counted in the current window (so callers can say "2 left"). */
  count: number;
};

/**
 * Fixed-window counter in the database - no extra service to run. Races at the boundary can
 * cost one extra attempt, which is an acceptable trade for not adding a second vendor to a
 * three-person admin.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const db = getDb();
  const now = Date.now();
  const [existing] = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  const windowMs = windowMinutes * 60_000;

  if (!existing || new Date(existing.windowStart).getTime() + windowMs <= now) {
    await db
      .insert(rateLimits)
      .values({ key, windowStart: nowIso(), count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { windowStart: nowIso(), count: 1 },
      });
    return { allowed: true, retryAfterSeconds: 0, count: 1 };
  }

  const count = existing.count + 1;
  await db.update(rateLimits).set({ count }).where(eq(rateLimits.key, key));

  // The current request is still counted even when it is refused.
  const windowEnd = new Date(existing.windowStart).getTime() + windowMs;
  const allowed = existing.count < limit;

  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    count,
  };
}

/**
 * Forgets a counter. Used when a sign-in succeeds, so a user who mistyped twice and then got
 * it right does not carry those failures into their next visit.
 */
export async function clearRateLimit(key: string): Promise<void> {
  await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Coarse client identity for throttling: a salted hash, never a raw IP. */
export function clientIpHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return sha256(`${ip}:${getEnv().IP_HASH_SALT}`);
}

// ---- sessions -------------------------------------------------------------------------

export type CreatedSession = { token: string; expiresAt: string };

export async function createSession(
  userId: string,
  request: Request,
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = minutesFromNow(getEnv().SESSION_TTL_HOURS * 60);

  await getDb()
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      userId,
      createdAt: nowIso(),
      expiresAt,
      lastSeenAt: nowIso(),
      ipHash: clientIpHash(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    });

  return { token, expiresAt };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ revokedAt: nowIso() })
    .where(eq(sessions.tokenHash, sha256(token)));
}

/**
 * Used when a user changes their own password (keeping the current session) and when an
 * admin disables a user, resets their password or asks for "sign out everywhere". Returns
 * how many sessions it actually ended, which is what the audit rows record.
 */
export async function revokeUserSessions(
  userId: string,
  exceptTokenHash?: string,
): Promise<number> {
  const stillLive = isNull(sessions.revokedAt);
  const revoked = await getDb()
    .update(sessions)
    .set({ revokedAt: nowIso() })
    .where(
      exceptTokenHash
        ? and(
            eq(sessions.userId, userId),
            stillLive,
            ne(sessions.tokenHash, exceptTokenHash),
          )
        : and(eq(sessions.userId, userId), stillLive),
    )
    .returning({ tokenHash: sessions.tokenHash });

  return revoked.length;
}

async function findSessionUser(token: string): Promise<SessionUser | undefined> {
  const [row] = await getDb()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .limit(1);

  if (!row) return undefined;

  const { session, user } = row;

  if (session.revokedAt) return undefined;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return undefined;
  if (user.status !== "active") return undefined;

  // Sliding renewal, written at most once every SESSION_TOUCH_MINUTES so a burst of requests
  // does not become a burst of writes.
  if (Date.now() - new Date(session.lastSeenAt).getTime() > SESSION_TOUCH_MINUTES * 60_000) {
    await getDb()
      .update(sessions)
      .set({
        lastSeenAt: nowIso(),
        expiresAt: minutesFromNow(getEnv().SESSION_TTL_HOURS * 60),
      })
      .where(eq(sessions.tokenHash, session.tokenHash));
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    sessionTokenHash: session.tokenHash,
  };
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies(); // async since Next 15
  return store.get(SESSION_COOKIE)?.value;
}

/** The signed-in user, or undefined. Never throws: a database hiccup must not 500 a page. */
export async function getSessionUser(): Promise<SessionUser | undefined> {
  const token = await getSessionToken();
  if (!token) return undefined;

  try {
    return await findSessionUser(token);
  } catch (error) {
    console.error("[cms] session lookup failed:", error);
    return undefined;
  }
}

export const hasRole = (user: SessionUser | undefined, role: UserRole): boolean =>
  user?.role === role;

// ---- sign-in bookkeeping --------------------------------------------------------------

export type LoginFailureState = { locked: boolean; lockedUntil?: string };

export async function recordFailedLogin(userId: string): Promise<LoginFailureState> {
  const db = getDb();
  const [row] = await db
    .select({ attempts: users.failedAttempts })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const attempts = (row?.attempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = locked ? minutesFromNow(LOCKOUT_MINUTES) : null;

  await db
    .update(users)
    .set({
      // A lockout clears the counter, so the next failure after it starts again at 1.
      failedAttempts: locked ? 0 : attempts,
      lockedUntil,
      updatedAt: nowIso(),
    })
    .where(eq(users.id, userId));

  return { locked, lockedUntil: lockedUntil ?? undefined };
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: nowIso() })
    .where(eq(users.id, userId));
}

export const isLocked = (lockedUntil: string | null | undefined): boolean =>
  Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());

// ---- request guards -------------------------------------------------------------------

/**
 * `HttpOnly` · `SameSite=Lax` · `Secure` outside development - the dev server is plain http,
 * where a Secure cookie would simply never be stored.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * CSRF defence for state-changing requests: a browser always sends `Origin` on a cross-site
 * POST, so a mismatched origin is refused. A request with neither `Origin` nor `Referer` is
 * not a browser (curl, a script), so it is allowed.
 */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const expected = getEnv().APP_ORIGIN ?? (host ? `${protocol}://${host}` : undefined);

  if (origin) return origin === expected;

  const referer = request.headers.get("referer");
  if (referer) return expected ? referer.startsWith(expected) : false;

  return true;
}

/** Page guard: a signed-out visitor goes to sign-in, an unfinished one to the password screen. */
export async function requireUserPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/signin");
  if (user.mustChangePassword) redirect("/admin/password");
  return user;
}

export type ApiAuthResult = { user: SessionUser } | { response: NextResponse };

/**
 * API guard - route handlers use this rather than the page guard, so an unauthenticated
 * fetch receives JSON `401` instead of an HTML redirect.
 */
export async function requireApiUser(
  options: { role?: UserRole; allowPendingPasswordChange?: boolean } = {},
): Promise<ApiAuthResult> {
  const user = await getSessionUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    return {
      response: NextResponse.json({ error: "Password change required" }, { status: 403 }),
    };
  }
  if (options.role === "admin" && user.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}
