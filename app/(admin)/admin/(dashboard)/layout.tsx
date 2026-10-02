import type React from "react";

import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUserPage } from "@/lib/admin/auth";

// The authenticated shell: side nav + sticky top bar wrapping every signed-in page. It is a
// route group, so it does not appear in any URL - `/admin`, `/admin/properties` and the rest
// are unchanged. Sign-in and the forced password change sit outside it, on their own plain
// screens, so nobody sees the navigation before they are signed in.
//
// requireUserPage redirects to sign-in when signed out and to the password screen when the
// account still has to choose a password. The individual pages call it too - it is the guard
// that keeps them correct when opened directly, not a cost this layout is trying to avoid.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUserPage();

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, username: user.username, role: user.role }} />
      <SidebarInset>
        <AdminTopbar />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
