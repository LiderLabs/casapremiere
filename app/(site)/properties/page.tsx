import type { Metadata } from "next";

import { Header } from "@/components/header";
import { ShortlistFloat } from "@/components/property/shortlist-float";
import { FooterSection } from "@/components/sections/footer-section";
import { PropertiesExplorer } from "@/components/sections/properties-explorer";
import { SiteProviders } from "@/components/site-providers";
import { listPublicProperties } from "@/lib/cms/public";

// The catalogue, in full. Same server read as `/` — one call to
// listPublicProperties() that names this route's own surface — handed to the same
// provider stack through SiteProviders, so the quick-view drawer, the shortlist
// and the booking modal all work here exactly as they do on the landing page.
//
// Statically prerendered like `/`, and refreshed by revalidatePublishedPages()
// (lib/cms/revalidate.ts), so a publish is live here in seconds without a deploy.
export const metadata: Metadata = {
  title: "All Properties — CASA Premier",
  description:
    "Every published home at Adjiringanor, Accra — plans, finishes and prices, with a quick view of each residence.",
};

export default async function PropertiesPage() {
  // The "listing" surface: everything published that the admin flagged for the
  // catalogue — including homes deliberately kept off the landing page's grid.
  const properties = await listPublicProperties("listing");

  return (
    <SiteProviders properties={properties}>
      <main className="min-h-screen bg-background">
        <Header />
        {/* No hero above it, so the explorer supplies its own top spacing. */}
        <PropertiesExplorer />
        <FooterSection />
        <ShortlistFloat />
      </main>
    </SiteProviders>
  );
}
