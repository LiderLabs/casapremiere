import { History } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
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

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  // Editors may read (spec D9 allows publish; history is how they see who did what).
  const user = await requireUserPage();
  const entries = await listRecentAudit(50);

  return (
    <div className="space-y-8">
      <PageHeader
        title="History"
        description={
          <>
            The last 50 changes, most recent first. Signed in as{" "}
            <span className="font-medium text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase tracking-wide">{user.role}</span>.
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity log</CardTitle>
          <CardDescription>
            Every write names its actor. Each row keeps the action, who did it and which entity
            it touched.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>No activity yet</EmptyTitle>
                <EmptyDescription>
                  Publishing, editing and account changes will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
