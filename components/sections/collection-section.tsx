"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PropertyCard } from "@/components/property/property-card";
import { useProperty } from "@/components/property/property-provider";

// The catalogue comes from PropertyProvider — the published rows the server read for the *home*
// surface via lib/cms/public.ts — so the grid and the quick-view drawer can never disagree and a
// published edit appears here on the next revalidation (docs/cms-build-spec.md D7).
//
// There is no count in this file any more. How many homes the landing page previews is the
// admin's decision rather than a constant: each property carries a "show on the home page" flag,
// and this grid is exactly the published homes that have it (docs/cms-build-spec.md §9). That is
// what keeps the grid a shop window and `/properties` — its own flag, its own surface — the
// catalogue.
export function CollectionSection() {
  const { properties } = useProperty();

  // An empty catalogue renders no cards rather than a broken placeholder: a draft-only
  // database is a normal state while the admin is being used.
  if (properties.length === 0) return null;

  return (
    <section id="properties" className="bg-background">
      {/* Section Title */}
      <div className="px-6 py-20 md:px-12 lg:px-20 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              Selected Portfolio
            </p>
            <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              Featured Properties
            </h2>
          </div>

          {/* The way through to the whole catalogue and its filters. A route
              link, not a hash anchor: /properties is its own page. */}
          <Link
            href="/properties"
            className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            See all properties
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      {/* Properties Grid/Carousel */}
      <div className="pb-24">
        {/* Mobile: Horizontal Carousel */}
        <div className="flex gap-6 overflow-x-auto px-6 pb-4 md:hidden snap-x snap-mandatory scrollbar-hide">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              className="w-[75vw] flex-shrink-0 snap-center"
            />
          ))}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 md:px-12 lg:px-20">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      </div>
    </section>
  );
}
