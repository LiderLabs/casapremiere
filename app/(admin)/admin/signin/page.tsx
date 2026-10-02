import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/admin/auth";

import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

/**
 * Only `/admin…` destinations are accepted, so `?next=` cannot be turned into an open
 * redirect that bounces a freshly signed-in user to another site.
 */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/admin")) return "/admin";
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/admin/password" : next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <CardTitle className="text-2xl">Content sign-in</CardTitle>
          <CardDescription>
            Accounts are created by an administrator in the admin itself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
