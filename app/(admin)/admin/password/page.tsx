import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/admin/auth";

import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  // Note: getSessionUser, not requireUserPage - the page guard sends anyone with a pending
  // password change here, so using it here would loop.
  const user = await getSessionUser();
  if (!user) redirect("/admin/signin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        CASA Première
      </p>
      <h1 className="mt-2 text-2xl font-medium">
        {user.mustChangePassword ? "Choose your password" : "Change your password"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {user.mustChangePassword
          ? "This account was created with a temporary password. Choose your own to continue."
          : "Changing your password signs you out on every other device."}
      </p>

      <PasswordForm mustChangePassword={user.mustChangePassword} />

      {user.mustChangePassword ? null : (
        <p className="mt-6 text-sm">
          <Link className="underline underline-offset-4" href="/admin">
            Back to the dashboard
          </Link>
        </p>
      )}
    </main>
  );
}
