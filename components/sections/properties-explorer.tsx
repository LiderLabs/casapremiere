"use client";

import { useEffect, useMemo, useState } from "react";

import { PropertyCard } from "@/components/property/property-card";
import { useProperty } from "@/components/property/property-provider";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/properties";
import { cn } from "@/lib/utils";

/**
 * The chip that shows everything. Declared as a literal *before* the union, so
 * `status === ALL` narrows `StatusFilter` down to `PropertyStatus` in the
 * `else` branch — annotating it as `StatusFilter` would widen it and break that.
 * "all" is not a `PropertyStatus`, so it cannot collide with a real one, and a
 * fifth status added to PROPERTY_STATUSES needs no change here.
 */
const ALL = "all" as const;

type StatusFilter = PropertyStatus | typeof ALL;

/** `Under construction` → `under-construction`, for the query string. */
function statusToParam(status: PropertyStatus): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function paramToStatus(value: string | null): StatusFilter {
  if (!value) return ALL;
  return (
    PROPERTY_STATUSES.find((status) => statusToParam(status) === value) ?? ALL
  );
}

/**
 * Mirrors the active filter in `?status=<slug>`, the way PropertyProvider
 * mirrors the open drawer in `?property=<slug>`: a filtered view can be shared
 * or reloaded, and the drawer's own param is left alone so
 * `?status=available&property=the-heights` survives a chip click.
 *
 * `history.replaceState` rather than a navigation on purpose — the catalogue is
 * already in the client tree, so filtering must not cost a round trip, and the
 * back button should leave the page rather than walk back through chip clicks.
 */
function syncUrl(status: StatusFilter) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  if (status === ALL) {
    url.searchParams.delete("status");
  } else {
    url.searchParams.set("status", statusToParam(status));
  }

  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

/**
 * The full published catalogue, with a status filter.
 *
 * This is the one thing the landing page's Featured Properties grid cannot do —
 * that grid is a preview — so the filter chips are what make this route worth
 * having rather than a second copy of the same cards. Every chip is derived from
 * the catalogue in front of it and carries its own count, so no chip can lead to
 * an empty grid and a status with no homes yet simply has no chip.
 */
export function PropertiesExplorer() {
  const { properties } = useProperty();
  const [status, setStatus] = useState<StatusFilter>(ALL);

  // Deep link: /properties?status=available opens already filtered. Deferred to
  // an effect because the server has no query string to prerender from — the
  // page is static and refreshed by revalidation, not rendered per request.
  useEffect(() => {
    setStatus(
      paramToStatus(new URLSearchParams(window.location.search).get("status")),
    );
  }, []);

  // Counts come from what is actually published, in the grid's own order, so the
  // chip list says "Available 3" only when three Available homes are on screen.
  const counts = useMemo(() => {
    const map = new Map<PropertyStatus, number>();
    for (const property of properties) {
      map.set(property.status, (map.get(property.status) ?? 0) + 1);
    }
    return map;
  }, [properties]);

  const visible = useMemo(
    () =>
      status === ALL
        ? properties
        : properties.filter((property) => property.status === status),
    [properties, status],
  );

  const chips: { value: StatusFilter; label: string; count: number }[] = [
    { value: ALL, label: "All", count: properties.length },
    ...PROPERTY_STATUSES.filter((value) => (counts.get(value) ?? 0) > 0).map(
      (value) => ({
        value,
        label: value,
        count: counts.get(value) ?? 0,
      }),
    ),
  ];

  const select = (next: StatusFilter) => {
    setStatus(next);
    syncUrl(next);
  };

  return (
    <section className="bg-background px-6 pt-32 pb-24 md:px-12 lg:px-20">
      {/* pt-32 clears the fixed header pill (fixed top-4, ~56px tall, plus the
          scroll offset it reserves) without any JavaScript. */}
      <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
        The Estate
      </p>
      <h1 className="text-3xl font-medium tracking-tight text-foreground md:text-5xl">
        All Properties
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
        Every home we have published at Adjiringanor, Accra. Open one for the
        plan, the finishes and what it costs.
      </p>

      {/* An empty catalogue is a normal state while the admin is being used, so
          the page keeps its heading and explains itself rather than 404-ing. */}
      {properties.length === 0 ? (
        <p className="mt-16 max-w-xl text-sm leading-relaxed text-muted-foreground">
          No homes are published yet. New listings appear here as soon as they go
          live.
        </p>
      ) : (
        <>
          {/* Filters and count. Inverted pills, matching the site's own controls
              (the header CTA, Book a Consultation), not the admin's ToggleGroup. */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
            <div
              role="group"
              aria-label="Filter properties by status"
              className="flex flex-wrap gap-2"
            >
              {chips.map((chip) => {
                const isActive = chip.value === status;

                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => select(chip.value)}
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                    )}
                  >
                    {chip.label}
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        isActive ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Announced, because filtering changes the list in place and a
                screen reader gets no other signal that it happened. */}
            <p
              aria-live="polite"
              className="text-xs uppercase tracking-widest text-muted-foreground"
            >
              Showing {visible.length} of {properties.length}
            </p>
          </div>

          {/* Grid. One grid at every width, unlike the landing page's mobile
              carousel: a filtered list has no fixed length to swipe through. */}
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
