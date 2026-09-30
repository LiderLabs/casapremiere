"use client";

import { useMemo } from "react";
import { track } from "@vercel/analytics";
import { ArrowUpRight, Heart, MessageCircle, X } from "lucide-react";

import { FadeImage } from "@/components/fade-image";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useBooking } from "@/components/booking/booking-provider";
import { useProperty } from "@/components/property/property-provider";
import {
  removeFromShortlist,
  useShortlistSlugs,
} from "@/components/property/shortlist-store";
import { BOOKING_HOURS_LABEL, bookingWhatsAppHref } from "@/lib/booking";
import {
  CROSS_SELL_BOOKING_EVENT,
  crossSellBookingAnalyticsProps,
} from "@/lib/cross-sell";
import { findPropertyBySlug, type Property } from "@/lib/properties";
import { cn } from "@/lib/utils";

/** Matches the sheet's 300ms close transition, so two overlays never fight for focus. */
const HANDOFF_MS = 300;

/** A price with no digits is still a placeholder, so it stays hidden. */
function hasFigure(value: string) {
  return /\d/.test(value);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type ShortlistPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShortlistPanel({ open, onOpenChange }: ShortlistPanelProps) {
  const isMobile = useIsMobile();
  const slugs = useShortlistSlugs();
  const { openBooking } = useBooking();
  const { openProperty, properties } = useProperty();

  // Resolve the saved slugs against the catalogue the page was rendered with. Ordering
  // follows the grid rather than click order, so the studio reads the homes the way the site
  // presents them — and a slug that is no longer published simply drops out.
  const savedProperties = useMemo(
    () =>
      slugs
        .map((slug) => findPropertyBySlug(properties, slug))
        .filter((property): property is Property => Boolean(property))
        .sort((a, b) => properties.indexOf(a) - properties.indexOf(b)),
    [slugs, properties],
  );

  const count = savedProperties.length;

  const listSummary = useMemo(
    () =>
      savedProperties
        .map((property, index) => {
          const price = hasFigure(property.price) ? ` - ${property.price}` : "";
          return `${index + 1}. ${property.name}, ${property.location}${price}`;
        })
        .join("\n"),
    [savedProperties],
  );

  const viewingContext = savedProperties
    .map((property) => `${property.name}, ${property.location}`)
    .join("; ");

  const requestViewings = () => {
    onOpenChange(false);
    window.setTimeout(
      () =>
        openBooking({
          service: "Buy a property",
          location: viewingContext,
          notes: `Shortlist:\n${listSummary}`,
        }),
      HANDOFF_MS,
    );
  };

  /**
   * Cross-sell: the same studio fits out the homes it sells, and the interior is
   * usually decided at the same time as the house - so a shortlist can carry an
   * interior-design request alongside the viewings.
   */
  const addInteriorDesign = () => {
    onOpenChange(false);
    track(
      CROSS_SELL_BOOKING_EVENT,
      crossSellBookingAnalyticsProps("estate-shortlist", "Interior design"),
    );
    window.setTimeout(
      () =>
        openBooking({
          service: "Interior design",
          location: viewingContext,
          notes: `Interior design for these homes:\n${listSummary}`,
        }),
      HANDOFF_MS,
    );
  };

  const viewProperty = (slug: string) => {
    onOpenChange(false);
    window.setTimeout(() => openProperty(slug), HANDOFF_MS);
  };

  const browseProperties = () => {
    onOpenChange(false);
    window.setTimeout(() => {
      document.getElementById("properties")?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }, HANDOFF_MS);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          // Same treatment as the property drawer: full-screen on phones, a
          // right-hand panel from 768px up, above the fixed header pill.
          "z-[60] flex flex-col gap-0 border-border bg-background p-0 [&>button]:hidden",
          isMobile
            ? "inset-x-0 bottom-0 h-[100dvh] max-h-none w-full max-w-none rounded-none border-t-0"
            : "inset-y-0 right-0 h-full w-full border-l sm:max-w-[480px]",
        )}
      >
        <SheetHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border px-6 py-5 pr-14 text-left">
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              My shortlist
            </p>
            <SheetTitle className="mt-3 text-xl font-medium tracking-tight text-foreground">
              {count === 0
                ? "Nothing saved yet"
                : `${count} ${count === 1 ? "home" : "homes"} saved`}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {count === 0
                ? "Tap the heart on any home to keep it here."
                : "Compare them, then hand the whole list to the studio in one step."}
            </SheetDescription>
          </div>

          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close shortlist"
              className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {count === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Heart className="size-5" aria-hidden="true" />
              </span>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Saved homes appear here, so you can compare them and request
                viewings for several at once.
              </p>
              <button
                type="button"
                onClick={browseProperties}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline"
              >
                Browse properties
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {savedProperties.map((property) => (
                <li
                  key={property.slug}
                  className="flex gap-4 rounded-2xl border border-border p-3"
                >
                  <button
                    type="button"
                    onClick={() => viewProperty(property.slug)}
                    aria-label={`View ${property.name}`}
                    className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary"
                  >
                    <FadeImage
                      src={property.image || "/placeholder.svg"}
                      alt={property.name}
                      fill
                      className="object-cover"
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {property.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {property.location}
                      {hasFigure(property.meta) ? ` · ${property.meta}` : ""}
                    </p>
                    {hasFigure(property.price) ? (
                      <p className="mt-1 text-sm text-foreground">
                        {property.price}
                      </p>
                    ) : null}

                    <div className="mt-2 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => viewProperty(property.slug)}
                        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromShortlist(property.slug)}
                        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {count > 0 ? (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={requestViewings}
                className="flex-1 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                Request viewings
              </button>
              <a
                href={bookingWhatsAppHref({
                  service: "Buy a property",
                  location: viewingContext,
                  notes: `Shortlist:\n${listSummary}`,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Send on WhatsApp
              </a>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              We reply within one business day. Office hours {BOOKING_HOURS_LABEL}.{" "}
              Buying to fit out?{" "}
              <button
                type="button"
                onClick={addInteriorDesign}
                className="font-medium text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                Add interior design
              </button>{" "}
              to the same request.
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
