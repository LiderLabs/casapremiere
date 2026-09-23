"use client";

import { ArrowUpRight } from "lucide-react";
import { FadeImage } from "@/components/fade-image";
import { useProperty } from "@/components/property/property-provider";
import { PROPERTIES } from "@/lib/properties";

// Property data lives in lib/properties.ts so the grid and the quick-view
// drawer always agree.
export function CollectionSection() {
  const { openProperty } = useProperty();

  return (
    <section id="properties" className="bg-background">
      {/* Section Title */}
      <div className="px-6 py-20 md:px-12 lg:px-20 md:py-10">
        <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
          Selected Portfolio
        </p>
        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Featured Properties
        </h2>
      </div>

      {/* Properties Grid/Carousel */}
      <div className="pb-24">
        {/* Mobile: Horizontal Carousel */}
        <div className="flex gap-6 overflow-x-auto px-6 pb-4 md:hidden snap-x snap-mandatory scrollbar-hide">
          {PROPERTIES.map((property) => (
            <div key={property.id} className="group flex-shrink-0 w-[75vw] snap-center">
              {/* Image */}
              <button
                type="button"
                onClick={() => openProperty(property)}
                aria-label={`View ${property.name}`}
                className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl bg-secondary"
              >
                <FadeImage
                  src={property.image || "/placeholder.svg"}
                  alt={property.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </button>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {property.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.location} · {property.meta}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => openProperty(property)}
                      aria-haspopup="dialog"
                      className="mt-4 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground underline-offset-4 group-hover:underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                    >
                      View Property
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="text-lg font-medium text-foreground">
                    {property.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 md:px-12 lg:px-20">
          {PROPERTIES.map((property) => (
            <div key={property.id} className="group">
              {/* Image */}
              <button
                type="button"
                onClick={() => openProperty(property)}
                aria-label={`View ${property.name}`}
                className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl bg-secondary"
              >
                <FadeImage
                  src={property.image || "/placeholder.svg"}
                  alt={property.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </button>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {property.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.location} · {property.meta}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {property.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => openProperty(property)}
                      aria-haspopup="dialog"
                      className="mt-4 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground underline-offset-4 group-hover:underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                    >
                      View Property
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="font-medium text-foreground text-2xl">
                    {property.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
