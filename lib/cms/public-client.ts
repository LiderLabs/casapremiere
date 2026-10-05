// Where an R2 key renders in the browser. Client-safe copy of lib/cms/public.ts's rule:
// public paths and full URLs pass through, R2 keys use the public base URL (injected by the
// server page as a prop, because client components may not import server env) — or the
// in-app proxy (spec Section 22.1) when no base URL is configured.

export function mediaSrcClient(key: string, baseUrl?: string): string {
  if (!key) return "";
  if (key.startsWith("/") || /^https?:\/\//i.test(key)) return key;
  const base = baseUrl?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : `/api/media/${key}`;
}
