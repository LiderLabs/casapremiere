"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

import { findPropertyBySlug, type Property } from "@/lib/properties";

// Loaded on first open, so the drawer markup, gallery and spec tables stay out
// of the landing-page bundle (the same approach the booking modal uses).
const PropertyDrawer = dynamic(
  () => import("./property-drawer").then((mod) => mod.PropertyDrawer),
  { ssr: false },
);

type PropertyContextValue = {
  /**
   * The published catalogue, in grid order, as the server fetched it. Every consumer reads
   * this rather than a module-level array, so a published edit is what the grid, the drawer
   * pager and the shortlist all see.
   */
  properties: readonly Property[];
  /** Slug of the property currently in the drawer (kept while it animates out). */
  activeSlug: string | null;
  openProperty: (property: Property | string) => void;
  closeProperty: () => void;
};

const PropertyContext = createContext<PropertyContextValue | null>(null);

/**
 * Mirrors the open drawer in `?property=<slug>` so a quick view can be shared
 * or reloaded. Other query params (e.g. the booking deep link `?book=1`) and
 * the current hash are preserved.
 */
function syncUrl(slug: string | null) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  if (slug) {
    url.searchParams.set("property", slug);
  } else {
    url.searchParams.delete("property");
  }

  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

export function PropertyProvider({
  properties,
  children,
}: {
  /** Published catalogue, read server-side (lib/cms/public.ts) and passed down once. */
  properties: readonly Property[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const openSlug = useCallback((slug: string) => {
    setActiveSlug(slug);
    setHasOpened(true);
    setIsOpen(true);
    syncUrl(slug);
  }, []);

  const openProperty = useCallback(
    (property: Property | string) => {
      const slug = typeof property === "string" ? property : property.slug;
      if (!findPropertyBySlug(properties, slug)) return;
      openSlug(slug);
    },
    [openSlug, properties],
  );

  const closeProperty = useCallback(() => {
    setIsOpen(false);
    syncUrl(null);
  }, []);

  // Deep link: /?property=the-heights opens that home on load.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("property");
    if (slug && findPropertyBySlug(properties, slug)) {
      setActiveSlug(slug);
      setHasOpened(true);
      setIsOpen(true);
    }
  }, [properties]);

  const value = useMemo(
    () => ({ properties, activeSlug, openProperty, closeProperty }),
    [properties, activeSlug, openProperty, closeProperty],
  );

  const property = activeSlug ? findPropertyBySlug(properties, activeSlug) : undefined;

  return (
    <PropertyContext.Provider value={value}>
      {children}
      {/* Mounted once, on first open, so the close animation can play. The
          property is retained while closing so the panel never empties out. */}
      {hasOpened ? (
        <PropertyDrawer
          property={property}
          open={isOpen}
          onOpenChange={(next) => {
            if (!next) closeProperty();
          }}
          onNavigate={openSlug}
        />
      ) : null}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);

  if (!context) {
    throw new Error("useProperty must be used inside a PropertyProvider");
  }

  return context;
}
