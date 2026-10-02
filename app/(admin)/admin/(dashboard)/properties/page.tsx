import { PageHeader } from "@/components/admin/page-header";
import { requireUserPage } from "@/lib/admin/auth";
import { getEnv } from "@/lib/cms/env";
import { listProperties, listThumbnailKeys } from "@/lib/cms/queries";

import { PropertiesManager } from "./properties-manager";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  // The shell already guards, but this page is also reachable directly, so it guards too.
  // Editors may read and publish (spec D9); delete, reorder and settings stay admin-only,
  // enforced by the API and hidden in the UI.
  const user = await requireUserPage();
  const [properties, thumbnails] = await Promise.all([listProperties(), listThumbnailKeys()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Properties"
        description={
          properties.length === 1
            ? "1 property. Both public sites read this list."
            : `${properties.length} properties. Both public sites read this list.`
        }
      />
      <PropertiesManager
        properties={properties}
        role={user.role}
        thumbnails={thumbnails}
        publicBaseUrl={getEnv().R2_PUBLIC_BASE_URL}
      />
    </div>
  );
}
