"use client";

import { PropertyCardView } from "@/components/property/property-card-view";
import { useProperty } from "@/components/property/property-provider";
import { ShortlistHeart } from "@/components/property/shortlist-heart";
import type { Property } from "@/lib/properties";

/**
 * The grid's card: the presentational view (components/property/property-card-view.tsx) wired to
 * the two things only the public site can supply — the quick view it opens and the shortlist heart
 * that floats over it.
 *
 * The card reads the catalogue through `useProperty()` only to open the drawer, so it must sit
 * inside a PropertyProvider (see components/site-providers.tsx). Everything below this wrapper is
 * provider-free, which is what lets the admin's preview render the same card.
 */
export function PropertyCard({
  property,
  className,
}: {
  property: Property;
  /** Wrapper classes — the landing page's mobile carousel sizes and snaps each card itself. */
  className?: string;
}) {
  const { openProperty } = useProperty();

  return (
    <PropertyCardView
      property={property}
      className={className}
      onOpen={() => openProperty(property)}
      overlay={
        <ShortlistHeart
          slug={property.slug}
          name={property.name}
          overlay
          className="absolute top-3 right-3 z-10"
        />
      }
    />
  );
}
