import { defineConfig } from "drizzle-kit";

// Used by the schema tooling only: `drizzle-kit generate` reads lib/cms/schema.ts and writes
// SQL into ./drizzle. It deliberately carries no database credentials, and migrations are
// *applied* by `npm run cms:migrate` (scripts/cms-migrate.ts) through the same libSQL client
// the app uses - so one command works against a local file and against Turso.
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/cms/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
