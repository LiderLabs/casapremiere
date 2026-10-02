import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireUserPage } from "@/lib/admin/auth";
import { getEnv } from "@/lib/cms/env";
import { getProperty, listMedia } from "@/lib/cms/queries";

import { PropertyEditor } from "./property-editor";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ slug: string }>;
  /** `?preview=1` opens the pre-publish preview as the editor loads (the list links to it). */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPropertyEditorPage({ params, searchParams }: Context) {
  // Editors may edit and publish (spec D9); delete and reorder stay admin-only, enforced
  // by the API and hidden in the UI.
  const user = await requireUserPage();
  const { slug } = await params;
  const { preview } = await searchParams;

  const property = await getProperty(slug);
  if (!property) notFound();

  const media = await listMedia(slug);

  return (
    <div className="space-y-8">
      <PageHeader
        title={property.name}
        description={<span className="font-mono text-xs">{property.slug}</span>}
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/properties">All properties</Link>
          </Button>
        }
      />
      <PropertyEditor
        property={property}
        media={media}
        role={user.role}
        publicBaseUrl={getEnv().R2_PUBLIC_BASE_URL}
        initialPreviewOpen={preview === "1"}
      />
    </div>
  );
}
