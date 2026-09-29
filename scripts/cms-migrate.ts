// Applies ./drizzle migrations to whatever TURSO_DATABASE_URL points at.
//
//   npm run cms:migrate                     # the local file (development default)
//   npm run cms:migrate -- --turso          # Turso, credentials from .env.turso.local
//
// Either way it is the same migration folder through the same libSQL client, so the local
// file and Turso cannot drift: drizzle-kit's own `migrate` command would need credentials
// inside drizzle.config.ts, and this keeps them in the environment.
//
// A one-off target can always be forced from the shell, since the environment wins:
//
//   $env:TURSO_DATABASE_URL="file:./.local/cms.db"; npm run cms:migrate

import { migrate } from "drizzle-orm/libsql/migrator";

import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { databaseLabel, loadDatabaseEnv, parseArgs } from "./cli-utils";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDatabaseEnv(args);

  const env = getEnv();
  console.log(`[cms] applying migrations to the ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  await migrate(getDb(), { migrationsFolder: "./drizzle" });

  console.log("[cms] migrations applied");
  getDbClient().close();
}

main().catch((error) => {
  console.error("[cms] migration failed:", error);
  process.exit(1);
});
