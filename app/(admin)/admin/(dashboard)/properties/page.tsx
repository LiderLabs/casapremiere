import Link from "next/link";

import { requireUserPage } from "@/lib/admin/auth";
import { getEnv } from "@/lib/cms/env";
import { listProperties, listThumbnailKeys } from "@/lib/cms/queries";

import { PropertiesManager } from "./properties-manager";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  // Redirects to sign-in when signed out, and to the password screen when the account still
  // has to choose a password. Editors may read and publish (spec D9); delete, reorder and
  // settings stay admin-only, enforced by the API and hidden in the UI.
  const user = await requireUserPage();
  const [properties, thumbnails] = await Promise.all([listProperties(), listThumbnailKeys()]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <h1 className="mt-2 text-2xl font-medium">Properties</h1>
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

      <PropertiesManager
        properties={properties}
        role={user.role}
        thumbnails={thumbnails}
        publicBaseUrl={getEnv().R2_PUBLIC_BASE_URL}
      />
    </main>
  );
}
