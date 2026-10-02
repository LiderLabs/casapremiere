import Link from "next/link";

import { requireUserPage } from "@/lib/admin/auth";
import { formatAccra } from "@/lib/admin/format";
import { listRecentAudit } from "@/lib/cms/audit";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  // Editors may read (spec D9 allows publish; history is how they see who did what).
  const user = await requireUserPage();
  const entries = await listRecentAudit(50);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <h1 className="mt-2 text-2xl font-medium">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase">{user.role}</span> · last 50 entries
          </p>
        </div>
        <Link
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          href="/admin"
        >
          Back to content
        </Link>
      </header>

      <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
        {entries.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No activity yet.</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="px-4 py-2.5">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-mono text-xs">{entry.action}</span>
                <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                  {formatAccra(entry.at)}
                </time>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.actor}
                {entry.entityId ? ` → ${entry.entityId}` : ""}
                {entry.entity ? ` · ${entry.entity}` : ""}
              </p>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
