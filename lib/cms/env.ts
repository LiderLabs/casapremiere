// Server-only environment for the admin CMS.


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
  /** S3-compatible storage for property images (Cloudflare R2). Optional until Phase 6 uploads. */
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  /**
   * Public serving base, e.g. https://images.casapremiere.com. Optional: without it R2 keys
   * are read through the in-app proxy (GET /api/media/<key>, spec Section 22.1), and the S3 API URL
   * derived from the account id is used only for signing.
   */
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
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
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || undefined,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || undefined,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || undefined,
    R2_BUCKET: process.env.R2_BUCKET || undefined,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || undefined,
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

/** True when the R2 upload pipeline is configured (all four signing values present). */
export function isR2Configured(env: CmsEnv = getEnv()): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
}

/** Throws unless the R2 upload pipeline is configured. Upload routes use this. */
export function requireR2(env: CmsEnv = getEnv()): Required<Pick<CmsEnv, "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET">> & CmsEnv {
  if (!isR2Configured(env)) {
    throw new Error(
      "R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in the deployment environment (and .env.local for local work).",
    );
  }
  return env as Required<Pick<CmsEnv, "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET">> & CmsEnv;
}

export const SESSION_TTL_SECONDS = (hours: number): number => Math.floor(hours * 3600);
