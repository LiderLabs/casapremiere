import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { requireUserPage } from "@/lib/admin/auth";
import { getSettings } from "@/lib/cms/queries";
import { SETTING_LABELS, type SettingKey } from "@/lib/cms/validation";

import { SettingsManager } from "./settings-manager";

// Behind the session, so it is rendered per request - never prerendered, never cached.
export const dynamic = "force-dynamic";

// The key/value rows arrive as one object; the form wants an ordered list it can edit.
const ORDER: SettingKey[] = ["phone", "email", "whatsapp", "hours", "address", "footerLinks"];

export default async function AdminSettingsPage() {
  // Admin-only (spec D9): an editor who types the URL lands back on the dashboard rather
  // than on an error page; the API answers 403 for the same request.
  const user = await requireUserPage();
  if (user.role !== "admin") redirect("/admin");

  const settings = await getSettings();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="The phone number, email, WhatsApp, hours, address and footer links shown across both sites."
      />
      <SettingsManager initial={settings} order={ORDER} labels={SETTING_LABELS} />
    </div>
  );
}
