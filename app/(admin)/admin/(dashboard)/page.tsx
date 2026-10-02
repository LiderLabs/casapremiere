import Link from "next/link";
import { CheckCircle2, Clock, FileText, History } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireUserPage } from "@/lib/admin/auth";
import { formatAccra } from "@/lib/admin/format";
import { listRecentAudit } from "@/lib/cms/audit";
import { listProperties } from "@/lib/cms/queries";

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
    <div className="space-y-8">
      <PageHeader
        title="Content"
        description={
          <>
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase tracking-wide">{user.role}</span>
          </>
        }
        actions={
          <Button asChild>
            <Link href="/admin/properties">Manage properties</Link>
          </Button>
        }
      />

      <section aria-label="Catalogue status" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Live"
          value={live.length}
          hint="Published on both sites"
          icon={CheckCircle2}
          href="/admin/properties"
        />
        <StatCard
          label="Pending changes"
          value={pending.length}
          hint="Live rows edited since publish"
          icon={Clock}
          href="/admin/properties"
          tone={pending.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Drafts"
          value={drafts.length}
          hint="Not visible to visitors"
          icon={FileText}
          href="/admin/properties"
        />
      </section>

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publish pending</CardTitle>
            <CardDescription>
              These live properties were edited after they were last published.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {pending.map((property) => (
                <li
                  key={property.slug}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    className="text-sm font-medium underline-offset-4 hover:underline"
                    href={`/admin/properties/${property.slug}`}
                  >
                    {property.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    edited by {property.updatedBy} · {formatAccra(property.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>The last 10 changes, most recent first.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/audit">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>No activity yet</EmptyTitle>
                <EmptyDescription>
                  Changes you and your team make will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-xs">{entry.action}</span>
                  <span className="text-sm text-muted-foreground">{entry.actor}</span>
                  <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                    {formatAccra(entry.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
