// Hard-deletes users + their sessions. There is deliberately no DELETE /api/admin/users/:id
// hard-delete (that route soft-disables to keep the audit trail), so a full rebuild like
// "remove every local admin and start over with casa" needs this. Local-only by design:
// pass --turso only if you really mean production.
//
//   npx tsx scripts/admin-delete-user.ts --username casa
//   npx tsx scripts/admin-delete-user.ts --all
//   npx tsx scripts/admin-delete-user.ts --all --turso   # production - be sure
//
// Imports stay relative (no `@/*` aliases, no Next modules) so this runs under plain tsx.

import { eq } from "drizzle-orm";

import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { sessions, users } from "../lib/cms/schema";
import { databaseLabel, loadDatabaseEnv, parseArgs, stringArg } from "./cli-utils";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDatabaseEnv(args);

  const env = getEnv();
  console.log(`[cms] database: ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  const username = stringArg(args, "username");
  const all = args.all === true;

  if (!username && !all) {
    console.log(
      [
        "Usage: npx tsx scripts/admin-delete-user.ts (--username <name> | --all) [--turso]",
        "",
        "  --username <name>  delete one user and all of their sessions",
        "  --all              delete every user and every session",
        "  --turso            reach the production database (.env.turso.local)",
      ].join("\n"),
    );
    process.exit(1);
  }

  const db = getDb();
  const client = getDbClient();

  try {
    if (all) {
      const wipedSessions = await client.execute("delete from sessions");
      const wipedUsers = await client.execute("delete from users");
      console.log(
        `[cms] deleted all users (${wipedUsers.rowsAffected} row(s)) and all sessions (${wipedSessions.rowsAffected} row(s))`,
      );
    } else {
      const name = (username ?? "").trim().toLowerCase();
      const [target] = await db.select().from(users).where(eq(users.username, name)).limit(1);
      if (!target) throw new Error(`No user named "${name}".`);
      await client.execute({
        sql: "delete from sessions where user_id = ?",
        args: [target.id],
      });
      await db.delete(users).where(eq(users.id, target.id));
      console.log(`[cms] deleted user "${name}" and all of their sessions`);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`[cms] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
