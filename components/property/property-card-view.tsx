"use client";

import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { FadeImage } from "@/components/fade-image";
import { cn } from "@/lib/utils";
import type { Property } from "@/lib/properties";

/**
 * One home, as a card — the whole card, with nothing but props.
 *
 * No providers, no hooks, no state: the grid supplies a click handler and the shortlist heart,
 * and the admin's preview supplies neither (it hands over its own handler to switch tabs). That
 * is the point of the split — `/`, `/properties` and the editor's preview render the same card
 * markup, and the pixel gate's comparison of `/` against its baseline stays meaningful only while
 * there is exactly one implementation of it.
 */
export function PropertyCardView({
  property,
  className,
  onOpen,
  overlay,
}: {
  property: Property;
  /** Wrapper classes — the landing page's mobile carousel sizes and snaps each card itself. */
  className?: string;
  /** Opens the quick view. Omitted only where there is nothing to open. */
  onOpen?: () => void;
  /** Rendered between the image and the copy — the grid passes the shortlist heart. */
  overlay?: ReactNode;
}) {
  return (
    <div className={cn("group relative", className)}>
      {/* Image */}
      <button
        type="button"
        onClick={onOpen}
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

      {/* Sibling of the image button, not nested: interactive elements cannot be
          nested, and the card opens the drawer on its own. */}
      {overlay}

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
              onClick={onOpen}
              aria-haspopup="dialog"
              className="mt-4 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-foreground underline-offset-4 group-hover:underline hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
            >
              View Property
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          {/* text-lg md:text-2xl: the carousel is mobile-only and the grids are
              desktop-only, so one card serves both sizes with the type scale
              each surface already used. */}
          <span className="text-lg font-medium text-foreground md:text-2xl">
            {property.price}
          </span>
        </div>
      </div>
    </div>
  );
}