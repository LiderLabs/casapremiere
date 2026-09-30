import Link from "next/link";

import { requireUserPage } from "@/lib/admin/auth";
import { formatAccra } from "@/lib/admin/format";
import { listRecentAudit } from "@/lib/cms/audit";
import { listProperties } from "@/lib/cms/queries";

import { SignOutButton } from "./sign-out-button";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  // Redirects to sign-in when signed out, and to the password screen when the account still
  // has to choose a password.
  const user = await requireUserPage();
  const [properties, activity] = await Promise.all([listProperties(), listRecentAudit(10)]);

  const live = properties.filter((property) => property.published && !property.pendingChanges);
  const pending = properties.filter((property) => property.pendingChanges);
  const drafts = properties.filter((property) => !property.published);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <h1 className="mt-2 text-2xl font-medium">Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase">{user.role}</span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="mt-8 grid grid-cols-3 gap-3">
        {[
          { label: "Live", count: live.length },
          { label: "Pending", count: pending.length },
          { label: "Drafts", count: drafts.length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-4">
            <p className="text-2xl font-medium">{stat.count}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {pending.length > 0 ? (
        <section className="mt-6 rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium">Publish pending</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pending.map((property) => (
              <li key={property.slug}>
                <Link
                  className="underline underline-offset-4"
                  href={`/admin/properties/${property.slug}`}
                >
                  {property.name}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  — edited by {property.updatedBy} at {formatAccra(property.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Catalogue</h2>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link className="underline underline-offset-4" href="/admin/properties">
            Properties
          </Link>
          {user.role === "admin" ? (
            <>
              <Link className="underline underline-offset-4" href="/admin/users">
                Users
              </Link>
              <Link className="underline underline-offset-4" href="/admin/settings">
                Settings
              </Link>
            </>
          ) : null}
          <Link className="underline underline-offset-4" href="/admin/audit">
            History
          </Link>
          <Link className="underline underline-offset-4" href="/">
            Open the estate site
          </Link>
          <Link className="underline underline-offset-4" href="/interior">
            Open the interior site
          </Link>
          <Link className="underline underline-offset-4" href="/admin/password">
            Change password
          </Link>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {activity.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No activity yet.</li>
          ) : (
            activity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5"
              >
                <span className="font-mono text-xs">{entry.action}</span>
                <span className="text-sm text-muted-foreground">{entry.actor}</span>
                <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                  {formatAccra(entry.at)}
                </time>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

