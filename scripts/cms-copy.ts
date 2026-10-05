// Copies content from one CMS database to another. Read-only unless `--write`, so a dry run is
// always safe to point at production: it reports what it would do and touches nothing.
//
//   npm run cms:copy -- --to libsql://new-db.org.turso.io --to-token "…"
//   npm run cms:copy -- --from .local/cms.db --to libsql://new-db.org.turso.io --write
//   npm run cms:copy -- --turso --to .local/cms-backup.db --write        # export production
//
// Built for the account migration in docs/cms-runbook.md, and kept afterwards as the
// export/backup tool (docs/cms.md Section 10 lists `content:export` as planned): before this,
// content could only leave the database by opening a client by hand.
//
// Two deliberate differences from the other CLI scripts:
//
// 1. It does not import lib/cms/db.ts. That module caches exactly one client and one Drizzle
//    instance for the process — correct for the app, useless here, where two databases are open
//    at once. Reading through it a second time would silently copy one database onto itself.
// 2. It speaks raw SQL rather than Drizzle, so values round-trip verbatim: `published`,
//    `show_on_home`, `show_on_listing` and `must_change_password` are 0/1 integers in SQLite and
//    are written back as such, with no boolean coercion anywhere in between.
//
// `--turso` means "the database in .env.turso.local", the same as everywhere else; in a copy it
// names the --from side, since the interesting direction is usually outward.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client, type InValue, type Row } from "@libsql/client";

import { databaseLabel, loadEnvFile, parseArgs, stringArg } from "./cli-utils";

/**
 * The content tables, in foreign-key order: `property_media.slug` references `properties.slug`,
 * so the parent has to land first (SQLite does not enforce this unless `foreign_keys` is on —
 * libSQL leaves it off — but a consistent order costs nothing and survives that changing).
 *
 * `users` travels with the content on purpose: `properties.published_by` and `updated_by` name
 * accounts, and a migration that dropped them would leave rows pointing at nobody.
 */
const CONTENT_TABLES = ["users", "properties", "property_media", "settings"] as const;

/** What `cms:status` calls "the local file": `.env.local`, then the development default. */
const DEFAULT_SOURCE = "file:./.local/cms.db";

/** Rows per `batch`. 25 rows today; a bucket of media could be thousands. */
const CHUNK = 100;

type Endpoint = { url: string; token?: string };

/**
 * `libsql://…` and `https://…` pass through; a bare path (`.local/cms.db`) becomes a `file:` URL,
 * as does a Windows drive letter (`C:\…`) — which the scheme test alone would mangle.
 */
function normalizeUrl(value: string): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[A-Za-z]:[\\/]/.test(value);
  return hasScheme ? value : `file:${value}`;
}

/** libSQL creates the file, but not the directory holding it (same helper as lib/cms/db.ts). */
function ensureLocalDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const path = url.replace(/^file:(\/\/)?/, "");
  if (path.startsWith(":")) return; // :memory:
  mkdirSync(dirname(resolve(path)), { recursive: true });
}

/**
 * One side of the copy, in the order of preference: the `--from`/`--to` flag, then the
 * `SOURCE_*`/`TARGET_*` environment variables (so a token never has to go on the command line
 * and land in the shell history), then `--turso` for `.env.turso.local`.
 */
function resolveEndpoint(args: Record<string, string | true>, side: "from" | "to"): Endpoint | undefined {
  const flagToken = stringArg(args, `${side}-token`);
  const useTursoFile = side === "from" ? Boolean(args["from-turso"] ?? args.turso) : Boolean(args["to-turso"]);

  if (useTursoFile) {
    loadEnvFile(".env.turso.local");

    const url = process.env.TURSO_DATABASE_URL;
    if (!url || url.startsWith("file:")) {
      throw new Error(
        `--${side}-turso needs a libsql:// TURSO_DATABASE_URL in .env.turso.local (or pass --${side} explicitly).`,
      );
    }

    const token = flagToken ?? process.env.TURSO_AUTH_TOKEN;
    if (!token) throw new Error(`--${side}-turso needs TURSO_AUTH_TOKEN in .env.turso.local.`);

    return { url, token };
  }

  const envUrl = side === "from" ? process.env.SOURCE_DATABASE_URL : process.env.TARGET_DATABASE_URL;
  const envToken = side === "from" ? process.env.SOURCE_AUTH_TOKEN : process.env.TARGET_AUTH_TOKEN;
  const url = stringArg(args, side) ?? envUrl;

  if (!url) return undefined;
  return { url: normalizeUrl(url), token: flagToken ?? envToken };
}

/** Only plain identifiers ever reach a SQL string; every value is bound as a parameter. */
function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use "${name}" as a table name (plain identifiers only).`);
  }
  return `"${name}"`;
}

/** Empty when the table does not exist, which is how "never migrated" is detected. */
async function columnNames(client: Client, table: string): Promise<string[]> {
  const info = await client.execute(`pragma table_info(${quoteIdentifier(table)})`);
  return info.rows.map((row) => String(row.name));
}

async function countRows(client: Client, table: string): Promise<number> {
  const result = await client.execute(`select count(*) as n from ${quoteIdentifier(table)}`);
  return Number(result.rows[0]?.n ?? 0);
}

async function existingTables(client: Client): Promise<string[]> {
  const result = await client.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
  );
  return result.rows.map((row) => String(row.name));
}

/**
 * Parents before children, whatever order the caller listed them in: `sort` is stable, so
 * tables outside CONTENT_TABLES (an explicit `--tables audit_log`) keep the order they were given.
 */
function orderTables(names: string[]): string[] {
  const known = CONTENT_TABLES as readonly string[];
  return [...names].sort((a, b) => {
    const left = known.indexOf(a);
    const right = known.indexOf(b);
    return (left === -1 ? known.length : left) - (right === -1 ? known.length : right);
  });
}

type TablePlan = {
  table: string;
  columns: string[];
  rows: Row[];
  sourceCount: number;
  targetCount: number;
  /** Columns the source has and the target does not: the target is behind on migrations. */
  missing: string[];
};

/** Reads one table and works out how it maps onto the target. Writes nothing. */
async function planTable(
  source: Client,
  target: Client,
  table: string,
  allowMissing: boolean,
): Promise<TablePlan> {
  const sourceColumns = await columnNames(source, table);
  if (sourceColumns.length === 0) throw new Error(`The source has no table "${table}".`);

  const targetColumns = await columnNames(target, table);
  if (targetColumns.length === 0) {
    throw new Error(
      `The target has no table "${table}". Run \`npm run cms:migrate\` against the target first — a ` +
        "database that has never been migrated has no tables at all.",
    );
  }

  const missing = sourceColumns.filter((column) => !targetColumns.includes(column));
  if (missing.length > 0 && !allowMissing) {
    throw new Error(
      `The target is behind on migrations: ${table} is missing ${missing.join(", ")}. Bring the ` +
        "target up to date with `npm run cms:migrate` first — copying now would drop those columns " +
        "silently — or pass --skip-unknown-columns to copy only the columns it has.",
    );
  }

  const columns = sourceColumns.filter((column) => targetColumns.includes(column));
  const selected = await source.execute(
    `select ${columns.map(quoteIdentifier).join(", ")} from ${quoteIdentifier(table)}`,
  );

  return {
    table,
    columns,
    rows: selected.rows,
    sourceCount: selected.rows.length,
    targetCount: await countRows(target, table),
    missing,
  };
}

/** `insert or replace`, so re-running after a partial failure is safe and idempotent. */
async function writeTable(target: Client, plan: TablePlan): Promise<number> {
  const columnList = plan.columns.map(quoteIdentifier).join(", ");
  const placeholders = plan.columns.map(() => "?").join(", ");
  const sql = `insert or replace into ${quoteIdentifier(plan.table)} (${columnList}) values (${placeholders})`;

  let written = 0;
  for (let start = 0; start < plan.rows.length; start += CHUNK) {
    const chunk = plan.rows.slice(start, start + CHUNK);
    const statements: Array<[string, InValue[]]> = chunk.map((row) => [
      sql,
      plan.columns.map((column) => row[column] as InValue),
    ]);

    await target.batch(statements, "write");
    written += chunk.length;
  }

  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // .env.local first, and deliberately so: .env.turso.local also defines TURSO_DATABASE_URL, and a
  // `--to-turso` target must not be able to change which database counts as "the local one".
  loadEnvFile(".env.local");

  const source = resolveEndpoint(args, "from") ?? {
    url: process.env.TURSO_DATABASE_URL ?? DEFAULT_SOURCE,
    token: process.env.TURSO_AUTH_TOKEN,
  };
  const target = resolveEndpoint(args, "to");

  if (!target) {
    throw new Error("Nothing to copy to: pass --to <url>. See the usage block in scripts/cms-copy.ts.");
  }

  if (source.url === target.url) {
    throw new Error("--from and --to point at the same database; there is nothing to copy.");
  }

  const write = Boolean(args.write);
  const allowMissing = Boolean(args["skip-unknown-columns"]);
  const requested = orderTables(
    (stringArg(args, "tables") ?? CONTENT_TABLES.join(","))
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );

  if (requested.length === 0) throw new Error("--tables named nothing. Omit it to copy the content tables.");

  if (requested.includes("__drizzle_migrations")) {
    throw new Error(
      "--tables cannot include __drizzle_migrations: the target's migration bookkeeping has to be " +
        "its own. Run `npm run cms:migrate` against the target instead.",
    );
  }

  console.log(`[copy] source: ${databaseLabel(source.url)}`);
  console.log(`[copy] target: ${databaseLabel(target.url)}`);
  console.log(`[copy] tables: ${requested.join(", ")}`);
  console.log(`[copy] mode:   ${write ? "write" : "dry run (nothing is written without --write)"}`);

  ensureLocalDirectory(target.url);

  const sourceClient = createClient({ url: source.url, authToken: source.token });
  const targetClient = createClient({ url: target.url, authToken: target.token });

  try {
    // Every table is planned before a single row is written, so a schema mismatch fails the run
    // while the target is still untouched.
    const plans: TablePlan[] = [];
    for (const table of requested) {
      plans.push(await planTable(sourceClient, targetClient, table, allowMissing));
    }

    const width = Math.max(4, ...requested.map((table) => table.length));

    // What stays behind is a decision, so it is reported rather than quietly omitted: the audit
    // trail is the easiest thing to assume travelled along with the content. Four tables are
    // excluded by design — `sessions` is live credential state that should not travel,
    // `rate_limits` is transient, `audit_log` is development history, and `__drizzle_migrations`
    // is bookkeeping that must belong to the target (copying it would tell the target it had run
    // migrations it never ran). Anything else listed here was simply not requested.
    const leftBehind: string[] = [];
    for (const table of await existingTables(sourceClient)) {
      if (requested.includes(table)) continue;
      leftBehind.push(`${table} ${await countRows(sourceClient, table)}`);
    }
    if (leftBehind.length > 0) console.log(`[copy] left behind: ${leftBehind.join(" · ")}`);

    const occupied = plans.filter((plan) => plan.targetCount > 0);
    if (occupied.length > 0) {
      console.log(
        `[copy] target already holds: ${occupied.map((plan) => `${plan.table} ${plan.targetCount}`).join(" · ")}`,
      );

      if (write && !args.force) {
        throw new Error(
          "Refusing to overwrite those rows without --force. `insert or replace` makes a re-run " +
            "idempotent, but it is not reversible: a row it replaces is gone.",
        );
      }
    }

    if (!write) {
      for (const plan of plans) {
        console.log(
          `[copy]   ${plan.table.padEnd(width)}  source ${plan.sourceCount} → target ${plan.targetCount}`,
        );
        if (plan.missing.length > 0) {
          console.log(`[copy]   ${" ".repeat(width)}  would skip: ${plan.missing.join(", ")}`);
        }
      }

      console.log("[copy] dry run only — nothing was written. Add --write to copy.");
      return;
    }

    for (const plan of plans) {
      const written = await writeTable(targetClient, plan);
      console.log(`[copy]   ${plan.table.padEnd(width)}  copied ${written}/${plan.sourceCount}`);
    }

    // The copy is finished only if both sides agree, table by table.
    let mismatched = false;
    const verified: string[] = [];

    for (const plan of plans) {
      const from = await countRows(sourceClient, plan.table);
      const to = await countRows(targetClient, plan.table);
      if (from !== to) mismatched = true;
      verified.push(`${plan.table} ${to}/${from}`);
    }

    console.log(`[copy] verify (target/source): ${verified.join(" · ")}`);
    if (mismatched) throw new Error("Row counts differ between source and target: the copy is incomplete.");

    console.log("[copy] ok");
  } finally {
    sourceClient.close();
    targetClient.close();
  }
}

main().catch((error) => {
  console.error(`[copy] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});


