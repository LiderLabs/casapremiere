// The audit trail: the substitute for `git log` that content in a database gives up.
//
// Every mutation in the admin writes one row naming the actor, and the sign-in flow writes
// rows for successes, failures and lockouts too - so "who put that live?" and "was someone
// guessing passwords?" are both answerable from one table.

import { desc } from "drizzle-orm";

import { getDb } from "./db";
import { auditLog } from "./schema";

export type AuditEvent = {
  /** Username of the signed-in user, or `unknown:<username>` for a failed sign-in. */
  actor: string;
  /** Dotted action name, e.g. `auth.login`, `auth.login_failed`, `user.create`. */
  action: string;
  /** Entity kind, e.g. `user` (Phase 2 adds `property`, `media`, `settings`). */
  entity: string;
  entityId?: string | null;
  /** Small JSON payload: never a password, never a session token. */
  payload?: unknown;
};

/**
 * Audit writes are deliberately non-fatal: a failure to record history must not fail the
 * action it describes. Errors are logged and swallowed.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  try {
    await getDb()
      .insert(auditLog)
      .values({
        at: new Date().toISOString(),
        actor: event.actor,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        payload: event.payload === undefined ? null : JSON.stringify(event.payload),
      });
  } catch (error) {
    console.error("[cms] audit write failed:", event.action, error);
  }
}

/** Most recent entries first - used by the dashboard. */
export async function listRecentAudit(limit = 10) {
  return getDb().select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
}
