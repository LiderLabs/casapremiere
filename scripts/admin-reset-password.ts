// The break-glass recovery path: sets a new password for a user when there is no mail
// provider to send a reset link through, and revokes every session that user had open.
//
//   npm run admin:reset-password -- --username casa
//   npm run admin:reset-password -- --username casa --password "…"
//
// Imports stay relative (no `@/*` aliases, no Next modules) so this runs under plain tsx.

import { and, eq, isNull } from "drizzle-orm";

import { checkPasswordPolicy, hashPassword, normalizeUsername } from "../lib/admin/password";
import { writeAudit } from "../lib/cms/audit";
import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { sessions, users } from "../lib/cms/schema";
import {
  askHidden,
  databaseLabel,
  loadDatabaseEnv,
  parseArgs,
  stringArg,
} from "./cli-utils";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !stringArg(args, "username")) {
    console.log(
      [
        "Usage: npm run admin:reset-password -- --username <name> [--password <value>] [--turso]",
        "",
        "Resets a password, forces a change at next sign-in and signs the user out everywhere.",
        "  --turso   reach the production database (.env.turso.local)",
      ].join("\n"),
    );
    if (!args.help) process.exit(1);
    return;
  }

  loadDatabaseEnv(args);

  const username = normalizeUsername(stringArg(args, "username") ?? "");
  const env = getEnv();
  console.log(`[cms] database: ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) throw new Error(`No user named "${username}".`);

  const password =
    stringArg(args, "password") ?? (await askHidden(`New password for ${username}: `));

  const policy = checkPasswordPolicy(password, { username: user.username, name: user.name });
  if (!policy.ok) throw new Error(policy.message);

  const now = new Date().toISOString();

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
      updatedBy: "cli",
    })
    .where(eq(users.id, user.id));

  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)))
    .returning({ tokenHash: sessions.tokenHash });

  await writeAudit({
    actor: "cli",
    action: "user.reset_password",
    entity: "user",
    entityId: user.username,
    payload: { sessionsRevoked: revoked.length },
  });

  console.log(
    `[cms] password reset for "${user.username}" - ${revoked.length} session(s) revoked, must change at next sign-in`,
  );
  getDbClient().close();
}

main().catch((error) => {
  console.error(`[cms] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
