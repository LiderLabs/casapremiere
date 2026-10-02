import type React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The dashboard's count tiles. It is a server component - no hooks - so it renders as part
// of the dashboard's server pass. `href` turns the whole card into a link; `tone` fires the
// one accent the admin uses for "needs attention".

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "warning";
}) {
  const body = (
    <Card
      className={cn(
        "gap-0 py-0 transition-colors",
        href && "hover:border-foreground/25 hover:bg-accent/40",
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              tone === "warning" && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-2 focus-visible:outline-offset-4">
      {body}
    </Link>
  ) : (
    body
  );
}
