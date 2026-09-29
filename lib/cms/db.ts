// The libSQL client and the Drizzle instance for the CMS.
//
// Server-only. `@libsql/client` speaks both `file:` (development - no account, no env vars)
// and `libsql://` (Turso, production), so the schema, the migrations and every query are
// identical in both environments; only TURSO_DATABASE_URL differs.
//
// Both handles are created lazily and cached per process, because a serverless invocation
// that never touches the database should not pay to open it, and a half-configured
// environment should fail the request that needs the database rather than the build.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";
import { getEnv } from "./env";

let client: Client | undefined;
let database: ReturnType<typeof createDatabase> | undefined;

/** libSQL creates the file, but not the directory that holds it. */
function ensureLocalDirectory(url: string) {
  const path = url.replace(/^file:(\/\/)?/, "");
  if (path.startsWith(":")) return; // :memory:
  mkdirSync(dirname(resolve(path)), { recursive: true });
}

export function getDbClient(): Client {
  if (client) return client;

  const env = getEnv();
  const url = env.TURSO_DATABASE_URL;

  if (url.startsWith("file:")) ensureLocalDirectory(url);

  client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
  return client;
}

function createDatabase() {
  return drizzle(getDbClient(), { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}

export { schema };
