// What is in the database right now. Read-only, so it is safe to point at production.
//
//   npm run cms:status              # the local file (development default)
//   npm run cms:status -- --turso   # Turso
//
// Answers the three questions that come up whenever a phase is finished: did the migrations
// land, do the tables exist, and which accounts can actually sign in. The alternative is a
// CLI against a database nobody normally opens.

import { count, desc } from "drizzle-orm";

import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { auditLog, properties, propertyMedia, settings, users } from "../lib/cms/schema";
import { databaseLabel, loadDatabaseEnv, parseArgs } from "./cli-utils";

const TABLES = ["users", "sessions", "rate_limits", "audit_log", "properties", "property_media", "settings"];

async function main() {
  loadDatabaseEnv(parseArgs(process.argv.slice(2)));

  const env = getEnv();
  console.log(`[cms] database: ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  const client = getDbClient();

  try {
    // A never-migrated database has no bookkeeping table at all, which is worth saying plainly.
    try {
      const applied = await client.execute(
        "select count(*) as applied from __drizzle_migrations",
      );
      console.log(`[cms] migrations applied: ${applied.rows[0]?.applied ?? 0}`);
    } catch {
      console.log("[cms] migrations applied: 0 (run npm run cms:migrate)");
    }

    const present = await client.execute(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    );
    const names = present.rows.map((row) => String(row.name));
    console.log(`[cms] tables: ${names.join(", ") || "(none)"}`);

    const missing = TABLES.filter((table) => !names.includes(table));
    if (missing.length > 0) console.log(`[cms] missing: ${missing.join(", ")}`);

    const db = getDb();
    const [account] = await db.select({ total: count() }).from(users);
    const [property] = await db.select({ total: count() }).from(properties);
    const [media] = await db.select({ total: count() }).from(propertyMedia);
    const [setting] = await db.select({ total: count() }).from(settings);

    console.log(
      `[cms] rows: users ${account?.total ?? 0} · properties ${property?.total ?? 0} · ` +
        `property_media ${media?.total ?? 0} · settings ${setting?.total ?? 0}`,
    );

    const accounts = await db
      .select({ username: users.username, role: users.role, status: users.status })
      .from(users)
      .orderBy(users.username);

    for (const row of accounts) {
      console.log(`[cms]   ${row.username} — ${row.role}, ${row.status}`);
    }

    // The audit trail is the substitute for git history, so it is worth being able to see it
    // without opening a database client: "did that change get recorded at all?"
    const [audit] = await db.select({ total: count() }).from(auditLog);
    console.log(`[cms] audit rows: ${audit?.total ?? 0}`);

    const recent = await db
      .select({ at: auditLog.at, actor: auditLog.actor, action: auditLog.action, entityId: auditLog.entityId })
      .from(auditLog)
      .orderBy(desc(auditLog.id))
      .limit(5);

    for (const row of recent) {
      console.log(`[cms]   ${row.at}  ${row.action}  ${row.actor}${row.entityId ? ` → ${row.entityId}` : ""}`);
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  // The one failure worth explaining: a Turso token that the database will not accept shows
  // up as a bare 401, and the fix is not obvious from that.
  if (message.includes("401") || message.includes("Unauthorized")) {
    console.error(
      "[cms] the database refused the credentials. Create a fresh token with\n" +
        "      `turso db tokens create <database>` and put it in .env.turso.local,\n" +
        "      then check TURSO_DATABASE_URL matches that database exactly.",
    );
  } else {
    console.error(`[cms] ${message}`);
  }

  process.exit(1);
});
