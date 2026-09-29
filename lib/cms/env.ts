// Server-only environment for the admin CMS.
//
// Two rules, both learned the hard way in other projects:
//
// 1. Nothing here may reach the browser. There is no `NEXT_PUBLIC_` prefix anywhere
//    in this module, and no client component may import it - the database URL, its
//    auth token and the IP-hash salt are secrets.
// 2. Validation is lazy. `getEnv()` runs on first use instead of at import time, so
//    a half-configured environment fails the request that needs it rather than
//    breaking `next build` route collection.
//
// Development runs on a local SQLite file (libSQL speaks both `file:` and `libsql://`),
// so `npm run dev` works with no account and no environment variables at all.

import { z } from "zod";

const DEV_DATABASE_URL = "file:./.local/cms.db";
/** Deliberately obvious: it must never be used outside development. */
const DEV_IP_HASH_SALT = "casa-dev-salt-not-a-secret";

const envSchema = z.object({
  /** `file:./.local/cms.db` in development, `libsql://<db>.<org>.turso.io` in production. */
  TURSO_DATABASE_URL: z.string().min(1),
  /** Not needed for a local file; required for Turso. */
  TURSO_AUTH_TOKEN: z.string().min(1).optional(),
  /** Exact origin the admin is served from, used by the CSRF origin check. */
  APP_ORIGIN: z.string().url().optional(),
  IP_HASH_SALT: z.string().min(16),
  /** Sliding session lifetime. Eight hours covers a working day. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type CmsEnv = z.infer<typeof envSchema>;

let cached: CmsEnv | undefined;

function readEnv(): CmsEnv {
  const isProduction = process.env.NODE_ENV === "production";

  const parsed = envSchema.safeParse({
    TURSO_DATABASE_URL:
      process.env.TURSO_DATABASE_URL ?? (isProduction ? undefined : DEV_DATABASE_URL),
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || undefined,
    APP_ORIGIN: process.env.APP_ORIGIN || undefined,
    IP_HASH_SALT: process.env.IP_HASH_SALT ?? (isProduction ? undefined : DEV_IP_HASH_SALT),
    SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS ?? 8,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} (${issue.message})`)
      .join(", ");
    throw new Error(
      `CMS environment is not configured: ${missing}. ` +
        "Set TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, APP_ORIGIN and IP_HASH_SALT in the deployment environment (and .env.local for local work).",
    );
  }

  const isRemoteDatabase = !parsed.data.TURSO_DATABASE_URL.startsWith("file:");

  if (isProduction && isRemoteDatabase && !parsed.data.TURSO_AUTH_TOKEN) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required when the CMS talks to a remote libSQL database (Turso).",
    );
  }

  return parsed.data;
}

export function getEnv(): CmsEnv {
  cached ??= readEnv();
  return cached;
}

/** True when the admin is talking to a local SQLite file rather than Turso. */
export function isLocalDatabase(env: CmsEnv = getEnv()): boolean {
  return env.TURSO_DATABASE_URL.startsWith("file:");
}

export const SESSION_TTL_SECONDS = (hours: number): number => Math.floor(hours * 3600);
