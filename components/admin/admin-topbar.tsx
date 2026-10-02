"use client";

// The sticky bar above every admin page. On desktop it carries a breadcrumb trail derived
// from the pathname; on mobile it collapses to the current page's label, and the
// SidebarTrigger (which opens the Sheet) is always visible.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  properties: "Properties",
  users: "Users",
  settings: "Settings",
  audit: "History",
};

type Crumb = { label: string; href: string };

/** "/admin/properties/foo" → Dashboard / Properties / foo (the slug keeps its own name). */
function trail(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/admin" }];

  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ label: LABELS[segment] ?? decodeURIComponent(segment), href });
  }
  return crumbs;
}

export function AdminTopbar() {
  const pathname = usePathname();
  const crumbs = trail(pathname);
  const current = crumbs[crumbs.length - 1];

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {last ? null : <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="truncate text-sm font-medium sm:hidden">{current?.label}</span>
    </header>
  );
}
