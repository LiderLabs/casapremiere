import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUserPage } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/users";

import { UsersManager } from "./users-manager";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Redirects to sign-in when signed out, and to the password screen when the account still
  // has to choose a password.
  const user = await requireUserPage();

  // Users are admin-only (spec §5.2). An editor who types the URL lands back on the dashboard
  // rather than on an error page; the API answers 403 for the same request.
  if (user.role !== "admin") redirect("/admin");

  const users = await listUsers();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <h1 className="mt-2 text-2xl font-medium">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase">{user.role}</span>
          </p>
        </div>
        <Link
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          href="/admin"
        >
          Back to content
        </Link>
      </header>

      <UsersManager users={users} currentUserId={user.id} />
    </main>
  );
}
