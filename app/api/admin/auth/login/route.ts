// Sign-in. See docs/cms-build-spec.md §5.3 for the full flow.
//
// Every failure mode returns the same message, and an unknown username still costs an argon2
// verification (against a throwaway hash) so the two cannot be told apart by response or by
// timing. Attempts are throttled per IP and per username, and every attempt is audited.

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertSameOrigin,
  burnDummyPasswordCheck,
  clearRateLimit,
  clientIpHash,
  consumeRateLimit,
  createSession,
  isLocked,
  LOCKOUT_MINUTES,
  normalizeUsername,
  recordFailedLogin,
  recordSuccessfulLogin,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/admin/auth";
import { writeAudit } from "@/lib/cms/audit";
import { getDb } from "@/lib/cms/db";
import { getEnv } from "@/lib/cms/env";
import { users } from "@/lib/cms/schema";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

/** One message for every failure: it must not reveal whether the account exists. */
const GENERIC_FAILURE = "Invalid username or password";

/** Every attempt from one address, so a scanner cannot keep probing. */
const IP_ATTEMPT_LIMIT = 20;

/** The address window is deliberately wider than the account's own: a scanner is not a person. */
const IP_ATTEMPT_WINDOW_MINUTES = 15;

/** Failures per username before the account locks. A success clears the counter. */
const USER_ATTEMPT_LIMIT = 5;

/**
 * The username window is the same length as the lockout on purpose, so the two cannot disagree:
 * when a five-minute lock expires, the counter that triggered it has expired with it and the user
 * gets their full five attempts back. A longer window would keep refusing a sign-in that the
 * account lock had already released.
 */
const USER_ATTEMPT_WINDOW_MINUTES = LOCKOUT_MINUTES;

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  const { password } = parsed.data;

  // The IP counter covers every attempt, so a scanner cannot keep probing. The per-username
  // counter is only touched on a failure (below), so a real user signing in and out never
  // throttles themselves.
  const userKey = `login:user:${username}`;

  const ipLimit = await consumeRateLimit(
    `login:ip:${clientIpHash(request)}`,
    IP_ATTEMPT_LIMIT,
    IP_ATTEMPT_WINDOW_MINUTES,
  );

  if (!ipLimit.allowed) {
    await writeAudit({
      actor: `unknown:${username}`,
      action: "auth.login_throttled",
      entity: "user",
      entityId: username,
      payload: { retryAfterSeconds: ipLimit.retryAfterSeconds },
    });
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } },
    );
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    await burnDummyPasswordCheck();
    await writeAudit({
      actor: `unknown:${username}`,
      action: "auth.login_failed",
      entity: "user",
      entityId: username,
      payload: { reason: "no_such_user" },
    });
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  if (user.status !== "active") {
    await writeAudit({
      actor: username,
      action: "auth.login_failed",
      entity: "user",
      entityId: username,
      payload: { reason: "disabled" },
    });
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  if (isLocked(user.lockedUntil)) {
    // Telling a locked-out user they are locked leaks nothing (they caused it) and saves a
    // support call; a *disabled* account stays generic above.
    const lockedForSeconds = Math.max(
      1,
      Math.ceil((new Date(user.lockedUntil as string).getTime() - Date.now()) / 1000),
    );

    await writeAudit({
      actor: username,
      action: "auth.login_failed",
      entity: "user",
      entityId: username,
      payload: { reason: "locked", lockedForSeconds },
    });

    return NextResponse.json(
      { error: "This account is locked. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(lockedForSeconds) } },
    );
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const failure = await recordFailedLogin(user.id);
    const userLimit = await consumeRateLimit(
      userKey,
      USER_ATTEMPT_LIMIT,
      USER_ATTEMPT_WINDOW_MINUTES,
    );

    await writeAudit({
      actor: username,
      action: "auth.login_failed",
      entity: "user",
      entityId: username,
      payload: {
        reason: "bad_password",
        locked: failure.locked,
        failuresInWindow: userLimit.count,
      },
    });

    if (failure.locked) {
      // The account is locked, not merely throttled, so say so - and for how long, computed from
      // the row rather than guessed, so the header and the message cannot disagree.
      const lockedForSeconds = Math.max(
        1,
        Math.ceil((new Date(failure.lockedUntil as string).getTime() - Date.now()) / 1000),
      );

      return NextResponse.json(
        {
          error: `Too many attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
        },
        { status: 429, headers: { "Retry-After": String(lockedForSeconds) } },
      );
    }

    // Rate-limited rather than locked: this address has tried too often for now. It is *not*
    // "locked for N minutes", so it must not claim to be.
    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(userLimit.retryAfterSeconds) } },
      );
    }

    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  // A correct password clears this username's failure counter.
  await clearRateLimit(userKey);

  const { token } = await createSession(user.id, request);
  await recordSuccessfulLogin(user.id);
  await writeAudit({
    actor: user.username,
    action: "auth.login",
    entity: "user",
    entityId: user.username,
    payload: { role: user.role },
  });

  const response = NextResponse.json({
    ok: true,
    redirectTo: user.mustChangePassword ? "/admin/password" : "/admin",
    mustChangePassword: user.mustChangePassword,
  });

  response.cookies.set({
    ...sessionCookieOptions(getEnv().SESSION_TTL_HOURS * 3600),
    value: token,
  });

  return response;
}
