// Creates an admin or editor account. This is the only bootstrap there is: no default
// credentials are seeded, in code or in a migration.
//
//   npm run admin:create-user -- --username casa --role admin
//   npm run admin:create-user -- --username ama --role editor --name "Ama" --password "…" --no-force-change
//
// The hash goes into the database; the plaintext is never stored, logged or echoed back.
// Imports stay relative (no `@/*` aliases, no Next modules) so this runs under plain tsx.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import {
  checkPasswordPolicy,
  hashPassword,
  normalizeUsername,
} from "../lib/admin/password";
import { writeAudit } from "../lib/cms/audit";
import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { users } from "../lib/cms/schema";
import {
  ask,
  askHidden,
  databaseLabel,
  loadDatabaseEnv,
  parseArgs,
  stringArg,
} from "./cli-utils";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

const USAGE = [
  'Usage: npm run admin:create-user -- --username <name> [options]',
  "",
  "  --username <name>     required, 3-32 chars: a-z 0-9 . _ -",
  "  --role <role>         admin | editor            (default: editor)",
  '  --name "<display>"    shown in the admin',
  "  --email <address>     optional",
  "  --password <value>    skips the hidden prompt (for scripted runs)",
  "  --no-force-change     do not require a password change at first sign-in",
  "  --turso               write to the production database (.env.turso.local)",
].join("\n");

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  // Loads .env.local, or .env.turso.local with --turso: Next does this for the app, but a
  // script run through tsx has no environment loader of its own.
  loadDatabaseEnv(args);

  const username = normalizeUsername(
    stringArg(args, "username") ?? (await ask("Username: ")),
  );
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "Username must be 3-32 characters: lowercase letters, digits, dot, underscore or hyphen.",
    );
  }

  const role = stringArg(args, "role") ?? "editor";
  if (role !== "admin" && role !== "editor") {
    throw new Error("--role must be admin or editor.");
  }

  const name = stringArg(args, "name") ?? "";
  const email = stringArg(args, "email");
  const forceChange = args["no-force-change"] !== true;

  const env = getEnv();
  console.log(`[cms] database: ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    throw new Error(
      `"${username}" already exists. Use npm run admin:reset-password to set a new password.`,
    );
  }

  const password =
    stringArg(args, "password") ?? (await askHidden(`Password for ${username}: `));

  const policy = checkPasswordPolicy(password, { username, name });
  if (!policy.ok) throw new Error(policy.message);

  const now = new Date().toISOString();

  await db.insert(users).values({
    id: randomUUID(),
    username,
    email: email ?? null,
    name,
    role,
    passwordHash: await hashPassword(password),
    mustChangePassword: forceChange,
    status: "active",
    createdAt: now,
    createdBy: "cli",
    updatedAt: now,
    updatedBy: "cli",
  });

  await writeAudit({
    actor: "cli",
    action: "user.create",
    entity: "user",
    entityId: username,
    payload: { role, forceChange },
  });

  console.log(
    `[cms] created ${role} "${username}"${
      forceChange ? " - must change password at first sign-in" : ""
    }`,
  );
  getDbClient().close();
}

main().catch((error) => {
  console.error(`[cms] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
