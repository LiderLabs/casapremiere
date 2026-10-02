import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/admin/auth";

import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  // Note: getSessionUser, not requireUserPage - the page guard sends anyone with a pending
  // password change here, so using it here would loop.
  const user = await getSessionUser();
  if (!user) redirect("/admin/signin");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <CardTitle className="text-2xl">
            {user.mustChangePassword ? "Choose your password" : "Change your password"}
          </CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? "This account was created with a temporary password. Choose your own to continue."
              : "Changing your password signs you out on every other device."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm mustChangePassword={user.mustChangePassword} />
        </CardContent>
        {user.mustChangePassword ? null : (
          <CardFooter>
            <Link className="text-sm underline underline-offset-4" href="/admin">
              Back to the dashboard
            </Link>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
