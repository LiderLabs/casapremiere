import type { ReactNode } from "react";

import { BookingProvider } from "@/components/booking/booking-provider";
import { MortgageProvider } from "@/components/mortgage/mortgage-provider";
import { PropertyProvider } from "@/components/property/property-provider";
import { ShortlistProvider } from "@/components/property/shortlist-provider";
import type { Property } from "@/lib/properties";

/**
 * The provider stack every estate route needs, in the one order that works.
 *
 * `/` and `/properties` are two views over the same catalogue, and the four
 * boundaries are entangled: the drawer opens the affordability calculator, the
 * calculator hands over to the booking modal, and the shortlist panel opens both
 * the appointment modal and the property drawer. Nesting them here rather than
 * inline in each page means a new estate route cannot be wired up in the wrong
 * order — or forget one — and every page behaves identically.
 *
 *   BookingProvider     outermost: owns the appointment modal, which everything
 *                       above it can open.
 *   MortgageProvider    outside PropertyProvider so the drawer can open the
 *                       calculator; inside BookingProvider so the calculator can
 *                       hand over to the modal.
 *   PropertyProvider    owns the catalogue and the quick-view drawer.
 *   ShortlistProvider   innermost: the panel opens the appointment modal and the
 *                       property drawer, so it must sit inside both.
 *
 * No "use client" here: a server component may render client providers, and the
 * catalogue crosses the boundary as a plain serialisable array.
 */
export function SiteProviders({
  properties,
  children,
}: {
  /** Published catalogue, read server-side (lib/cms/public.ts) and passed down once. */
  properties: readonly Property[];
  children: ReactNode;
}) {
  return (
    <BookingProvider>
      <MortgageProvider>
        <PropertyProvider properties={properties}>
          <ShortlistProvider>{children}</ShortlistProvider>
        </PropertyProvider>
      </MortgageProvider>
    </BookingProvider>
  );
}
