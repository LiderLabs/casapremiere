// Cross-site link to the sister project (Hously — the Exterior).
// Set NEXT_PUBLIC_SISTER_SITE_URL in .env.local / production env;
// falls back to the local dev port.
export const SISTER_SITE_URL =
  process.env.NEXT_PUBLIC_SISTER_SITE_URL ?? "http://localhost:3000";
