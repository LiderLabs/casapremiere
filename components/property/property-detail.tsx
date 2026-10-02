import {
  ArrowUpRight,
  Lamp,
  LayoutGrid,
  MapPin,
  Ruler,
  Sofa,
  Sparkles,
  Trees,
} from "lucide-react";

import { FadeImage } from "@/components/fade-image";
import { BOOKING_PHONE_HREF } from "@/lib/booking";
import { PROPERTY_HOST, type Property } from "@/lib/properties";
import { cn } from "@/lib/utils";

/**
 * The rules every view of a listing shares.
 *
 * These lived inside the drawer until the admin needed a preview. They are the parts that must not
 * disagree between the drawer and the preview — which icon a highlight key resolves to, whether a
 * price is finished, how a spec row reads — so they live here now and the drawer imports them,
 * rather than the preview growing its own copy that drifts on the next edit.
 */
export const HIGHLIGHT_ICONS = {
  space: LayoutGrid,
  light: Lamp,
  joinery: Ruler,
  outdoor: Trees,
  comfort: Sofa,
  detail: Sparkles,
} as const;

/** A price with no digits is still a placeholder, so it stays hidden. */
export function hasFigure(value: string) {
  return /\d/.test(value);
}

export function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-3 last:border-b-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * `location · meta`, with a meta placeholder dropped rather than shown as a stray dash — the same
 * rule the drawer applies, in the one place both it and the preview can reach.
 */
export function propertyMetaLine(property: Pick<Property, "location" | "meta">): string {
  return [property.location, hasFigure(property.meta) ? property.meta : ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * One listing, rendered for reading — the content of the quick view, without the parts of it that
 * only exist on the live site (the shortlist heart, the booking hand-offs, the affordability
 * calculator, the cross-site link).
 *
 * The admin's preview mounts this, which is why it takes a plain `Property` and nothing else: the
 * editor hands it its *unsaved* state, so the last look before publishing is the thing about to be
 * published rather than the last thing that was saved.
 */
export function PropertyDetail({
  property,
  className,
}: {
  property: Property;
  className?: string;
}) {
  const images = [property.hero, ...property.gallery];
  // The drawer's split, kept intact: a spec with a value is a row, a spec without one becomes a
  // line of "On request" rather than an empty cell.
  const confirmedSpecs = property.specs.filter((spec) => spec.value.trim().length > 0);
  const pendingSpecs = property.specs.filter((spec) => spec.value.trim().length === 0);
  const viewingContext = `${property.name}, ${property.location}`;

  return (
    <div className={cn("text-left", className)}>
      <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        {property.status}
      </span>
      <h3 className="mt-3 text-xl font-medium tracking-tight text-foreground">{property.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{propertyMetaLine(property)}</p>

      <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-lg bg-secondary">
        {images[0]?.src ? (
          <FadeImage src={images[0].src} alt={images[0].alt} fill className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
            no image yet
          </span>
        )}
      </div>

      {hasFigure(property.price) ? (
        <p className="mt-5 text-2xl font-medium text-foreground">{property.price}</p>
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">
          No price yet — the card hides a price that contains no figures.
        </p>
      )}

      {property.description ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {property.description}
        </p>
      ) : null}

      <h4 className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        About this property
      </h4>
      {property.intro.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No paragraphs yet.</p>
      ) : (
        property.intro.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))
      )}

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Highlights</h4>
      {property.highlights.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No highlights yet.</p>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {property.highlights.map((highlight) => {
            const Icon = HIGHLIGHT_ICONS[highlight.icon];

            return (
              <div key={`${highlight.icon}-${highlight.title}`}>
                <Icon className="size-5 text-foreground" strokeWidth={1.25} aria-hidden="true" />
                <h5 className="mt-3 text-base font-medium text-foreground">{highlight.title}</h5>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {highlight.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Gallery</h4>
      {images.length <= 1 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing in the gallery yet — the drawer shows the opening shot on its own.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image.src}-${index}`}
              className="relative aspect-[4/3] overflow-hidden rounded-lg bg-secondary"
            >
              <FadeImage src={image.src} alt={image.alt} fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">
        Specifications
      </h4>
      <div className="mt-2">
        {confirmedSpecs.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            Every spec row is empty, so all of them read as “On request”.
          </p>
        ) : (
          confirmedSpecs.map((spec) => (
            <SpecRow key={`${spec.label}-${spec.value}`} label={spec.label} value={spec.value} />
          ))
        )}
      </div>
      {pendingSpecs.length > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          On request: {pendingSpecs.map((spec) => spec.label).join(" · ")}
        </p>
      ) : null}

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Amenities</h4>
      {property.amenities.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No amenities listed yet.</p>
      ) : (
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
      )}

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Location</h4>
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

      <h4 className="mt-10 text-xs uppercase tracking-widest text-muted-foreground">Your host</h4>
      <p className="mt-4 text-sm text-foreground">
        {PROPERTY_HOST.name} — {PROPERTY_HOST.role}
      </p>
      <div className="mt-2 mb-2 flex flex-col gap-1">
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
  );
}