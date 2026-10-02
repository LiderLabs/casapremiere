"use client";

// The admin's side navigation. It is the one place that knows the admin's shape: the
// Manage group is filtered by role so an editor never sees Users or Settings (the API
// refuses those routes for the same reason), and the Sites group links back out to the two
// public surfaces. Collapsible to icons on desktop and a Sheet under 768px - both come from
// the shadcn sidebar primitives, so there is nothing bespoke to keep responsive.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ExternalLink,
  History,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { NavUser, type AdminIdentity } from "./nav-user";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Properties", href: "/admin/properties", icon: Building2 },
  { title: "Users", href: "/admin/users", icon: Users, adminOnly: true },
  { title: "Settings", href: "/admin/settings", icon: Settings, adminOnly: true },
  { title: "History", href: "/admin/audit", icon: History },
];

const SITES: { title: string; href: string }[] = [
  { title: "Estate site", href: "/" },
  { title: "Interior site", href: "/interior" },
];

/** `/admin` is exact; every other route also matches its own children. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ user }: { user: AdminIdentity }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="CASA Première Content">
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-mono text-xs font-semibold text-sidebar-primary-foreground">
                  CP
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">CASA Première</span>
                  <span className="truncate text-xs text-muted-foreground">Content</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(pathname, item.href)}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Sites</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SITES.map((site) => (
                <SidebarMenuItem key={site.href}>
                  <SidebarMenuButton asChild tooltip={site.title}>
                    <Link href={site.href} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      <span>{site.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
