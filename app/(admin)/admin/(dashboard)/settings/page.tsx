import Link from "next/link";

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
  if (user.role !== "admin") {
    const { redirect } = await import("next/navigation");
    redirect("/admin");
  }

  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            CASA Première
          </p>
          <h1 className="mt-2 text-2xl font-medium">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The phone number, email, WhatsApp, hours, address and footer links. An unset key
            falls back to the value still hard-coded in the sites.
          </p>
        </div>
        <Link
          className="text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          href="/admin"
        >
          Back to content
        </Link>
      </header>

      <SettingsManager initial={settings} order={ORDER} labels={SETTING_LABELS} />
    </main>
  );
}
