import { notFound } from "next/navigation";
import Link from "next/link";

import { requireUserPage } from "@/lib/admin/auth";
import { getEnv } from "@/lib/cms/env";
import { getProperty, listMedia } from "@/lib/cms/queries";

import { PropertyEditor } from "./property-editor";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export default async function AdminPropertyEditorPage({ params }: Context) {
  // Editors may edit and publish (spec D9); delete and reorder stay admin-only, enforced
  // by the API and hidden in the UI.
  const user = await requireUserPage();
  const { slug } = await params;

  const property = await getProperty(slug);
  if (!property) notFound();

  const media = await listMedia(slug);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première · {property.slug}
          </p>
          <h1 className="mt-2 text-2xl font-medium">{property.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{user.name || user.username}</span> ·{" "}
            <span className="uppercase">{user.role}</span>
          </p>
        </div>
        <Link
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          href="/admin/properties"
        >
          Back to properties
        </Link>
      </header>

      <PropertyEditor
        property={property}
        media={media}
        role={user.role}
        publicBaseUrl={getEnv().R2_PUBLIC_BASE_URL}
      />
    </main>
  );
}
