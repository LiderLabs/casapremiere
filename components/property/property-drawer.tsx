"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lamp,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Ruler,
  Sofa,
  Sparkles,
  Trees,
  X,
} from "lucide-react";

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
import { BOOKING_PHONE_HREF, bookingWhatsAppHref } from "@/lib/booking";
import { PROPERTIES, PROPERTY_HOST, type Property } from "@/lib/properties";
import { cn } from "@/lib/utils";

const HIGHLIGHT_ICONS = {
  space: LayoutGrid,
  light: Lamp,
  joinery: Ruler,
  outdoor: Trees,
  comfort: Sofa,
  detail: Sparkles,
} as const;

/** A price with no digits is still a placeholder, so it stays hidden. */
function hasFigure(value: string) {
  return /\d/.test(value);
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-3 last:border-b-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

type PropertyDrawerProps = {
  property: Property | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (slug: string) => void;
};

export function PropertyDrawer({
  property,
  open,
  onOpenChange,
  onNavigate,
}: PropertyDrawerProps) {
  const isMobile = useIsMobile();
  const { openBooking } = useBooking();
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Reset the gallery whenever the drawer switches homes.
  useEffect(() => {
    setImageIndex(0);
    setViewerIndex(null);
  }, [property?.slug]);

  if (!property) return null;

  const images = [property.hero, ...property.gallery];
  const activeIndex = Math.min(imageIndex, images.length - 1);
  const activeImage = images[activeIndex];
  const currentIndex = PROPERTIES.findIndex((item) => item.slug === property.slug);
  const previous = currentIndex > 0 ? PROPERTIES[currentIndex - 1] : undefined;
  const next =
    currentIndex < PROPERTIES.length - 1 ? PROPERTIES[currentIndex + 1] : undefined;

  const confirmedSpecs = property.specs.filter((spec) => spec.value.trim().length > 0);
  const pendingSpecs = property.specs.filter((spec) => spec.value.trim().length === 0);
  const viewingContext = `${property.name}, ${property.location}`;
  // The card shows `meta` exactly as authored; in the drawer an unfinished
  // placeholder (no digits yet) is dropped rather than shown as a stray dash.
  const metaLine = [
    property.location,
    hasFigure(property.meta) ? property.meta : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const showImage = (index: number) =>
    setImageIndex(((index % images.length) + images.length) % images.length);

  const bookViewing = () => {
    onOpenChange(false);
    setViewerIndex(null);
    // Let the sheet finish its 300ms close transition so the two overlays never
    // fight for focus, then open the appointment modal with the property preset.
    window.setTimeout(
      () => openBooking({ service: "Buy a property", location: viewingContext }),
      300,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          // Deliberately no position utility here: the primitive sets `fixed`,
          // and tailwind-merge would let a `relative` override it - which dropped
          // the panel into normal flow at the end of <body> instead of overlaying
          // the page. `fixed` is already the containing block for the viewer below.
          "z-[60] flex flex-col gap-0 border-border bg-background p-0 [&>button]:hidden",
          isMobile
            ? "inset-x-0 bottom-0 h-[100dvh] max-h-none w-full max-w-none rounded-none border-t-0"
            : "inset-y-0 right-0 h-full w-full border-l sm:max-w-[560px] lg:max-w-[640px]",
        )}
      >
        <SheetHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border px-6 py-5 pr-14 text-left">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {property.status}
            </span>
            <SheetTitle className="mt-3 text-xl font-medium tracking-tight text-foreground">
              {property.name}
            </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {metaLine}
            </SheetDescription>
          </div>

          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close property details"
              className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </SheetClose>
        </SheetHeader>
        {/* Scrolling body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
            <FadeImage
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              className="object-cover"
            />

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => showImage(activeIndex - 1)}
                  className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => showImage(activeIndex + 1)}
                  className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewerIndex(activeIndex)}
                  className="absolute bottom-3 right-3 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground transition-colors hover:bg-background"
                >
                  Expand
                </button>
              </>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-6 py-4">
              {images.map((image, index) => (
                <button
                  key={`${image.src}-${index}`}
                  type="button"
                  onClick={() => showImage(index)}
                  aria-label={`Show image ${index + 1}`}
                  className={cn(
                    "relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary",
                    index === activeIndex
                      ? "ring-1 ring-foreground"
                      : "opacity-70 transition-opacity hover:opacity-100",
                  )}
                >
                  <FadeImage
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
          <div className="px-6 pb-2">
            {hasFigure(property.price) ? (
              <p className="text-2xl font-medium text-foreground">{property.price}</p>
            ) : null}

            <h3 className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
              About this property
            </h3>
            {property.intro.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-4 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}

            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Highlights
            </h3>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              {property.highlights.map((highlight) => {
                const Icon = HIGHLIGHT_ICONS[highlight.icon];

                return (
                  <div key={highlight.title}>
                    <Icon
                      className="size-5 text-foreground"
                      strokeWidth={1.25}
                      aria-hidden="true"
                    />
                    <h4 className="mt-3 text-base font-medium text-foreground">
                      {highlight.title}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {highlight.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-6 pb-10">
            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Gallery
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <button
                  key={`grid-${image.src}-${index}`}
                  type="button"
                  onClick={() => setViewerIndex(index)}
                  aria-label={`Open image ${index + 1}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg bg-secondary"
                >
                  <FadeImage
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </button>
              ))}
            </div>

            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Specifications
            </h3>
            <div className="mt-2">
              {confirmedSpecs.map((spec) => (
                <SpecRow key={spec.label} label={spec.label} value={spec.value} />
              ))}
            </div>
            {pendingSpecs.length > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                On request: {pendingSpecs.map((spec) => spec.label).join(" · ")}
              </p>
            ) : null}

            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Amenities
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {amenity}
                </span>
              ))}
            </div>

            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Location
            </h3>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewingContext)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-foreground transition-opacity hover:opacity-70"
            >
              <MapPin className="size-4" aria-hidden="true" />
              {property.location}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>

            <h3 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
              Your host
            </h3>
            <p className="mt-4 text-sm text-foreground">
              {PROPERTY_HOST.name} — {PROPERTY_HOST.role}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <a
                href={BOOKING_PHONE_HREF}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {PROPERTY_HOST.phone}
              </a>
              <a
                href={`mailto:${PROPERTY_HOST.email}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {PROPERTY_HOST.email}
              </a>
            </div>
          </div>
        </div>
        {/* Sticky actions */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={bookViewing}
              className="flex-1 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Book a viewing
            </button>
            <a
              href={bookingWhatsAppHref({
                service: "Buy a property",
                location: viewingContext,
                notes: "I would like to arrange a viewing.",
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={!previous}
              onClick={() => previous && onNavigate(previous.slug)}
              className="inline-flex max-w-[42%] items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{previous ? previous.name : "Previous"}</span>
            </button>
            <span className="shrink-0 text-xs text-muted-foreground">
              {currentIndex + 1} of {PROPERTIES.length}
            </span>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onNavigate(next.slug)}
              className="inline-flex max-w-[42%] items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <span className="truncate">{next ? next.name : "Next"}</span>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* In-panel image viewer (kept inside the sheet so only one overlay
            is ever open - no nested dialog, no competing focus traps). */}
        {viewerIndex !== null ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-background">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {viewerIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={() => setViewerIndex(null)}
                aria-label="Close image"
                className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 bg-secondary">
              <FadeImage
                src={images[viewerIndex].src}
                alt={images[viewerIndex].alt}
                fill
                className="object-contain"
              />
            </div>

            <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                aria-label="Previous image"
                onClick={() =>
                  setViewerIndex((current) =>
                    current === null
                      ? current
                      : (current - 1 + images.length) % images.length,
                  )
                }
                className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() =>
                  setViewerIndex((current) =>
                    current === null ? current : (current + 1) % images.length,
                  )
                }
                className="flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
