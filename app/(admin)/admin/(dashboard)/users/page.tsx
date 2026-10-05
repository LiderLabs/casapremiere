import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { requireUserPage } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/users";

import { UsersManager } from "./users-manager";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Redirects to sign-in when signed out, and to the password screen when the account still
  // has to choose a password.
  const user = await requireUserPage();

  // Users are admin-only (spec Section 5.2). An editor who types the URL lands back on the dashboard
  // rather than on an error page; the API answers 403 for the same request.
  if (user.role !== "admin") redirect("/admin");

  const users = await listUsers();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description={
          users.length === 1 ? "1 account." : `${users.length} accounts.`
        }
      />
      <UsersManager users={users} currentUserId={user.id} />
    </div>
  );
}
