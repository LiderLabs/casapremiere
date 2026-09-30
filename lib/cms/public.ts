// The public read path's data: what `/` and `/interior` are allowed to show.
//
// One query for the published rows and one for their media, mapped into the exact `Property`
// shape lib/properties.ts declares. That is the shape six components already consume, so the
// Phase 7 swap from the hard-coded array to the database changes no component props — which is
// what keeps the pixel-identical diff credible.
//
// Server-only: it touches the database.

import { asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/cms/db";
import { getEnv } from "@/lib/cms/env";
import { mediaColumns, toPropertyRecord, type MediaRecord } from "@/lib/cms/queries";
import { properties, propertyMedia } from "@/lib/cms/schema";
import type { Property } from "@/lib/properties";

/**
 * Where an image is served from.
 *
 * A key that is already a public path (`/images/…` — the three existing homes) or a full URL
 * passes through untouched. An R2 key uses R2_PUBLIC_BASE_URL when configured; without it
 * the app proxies the bytes itself (GET /api/media/<key>, spec §22.1), so uploads render
 * with S3 API access only. Setting the base URL later flips every src to direct, same keys.
 */
export function mediaSrc(key: string): string {
  if (!key) return "";
  if (key.startsWith("/") || /^https?:\/\//i.test(key)) return key;

  const base = getEnv().R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/${key}` : `/api/media/${key}`;
}

/** Row + media → the `Property` the drawer, the grid and the interior band render. */
export function toPublicProperty(record: ReturnType<typeof toPropertyRecord>, media: MediaRecord[]): Property {
  const card = media.find((item) => item.role === "card");
  const hero = media.find((item) => item.role === "hero");
  const gallery = media
    .filter((item) => item.role === "gallery")
    .sort((a, b) => a.position - b.position);

  const fallbackAlt = `${record.name}, ${record.location}`;

  return {
    // The legacy array numbered the homes 1..n in grid order and `id` is only ever a React key,
    // so `position` is the faithful mapping: keys are stable while the order is.
    id: record.position,
    slug: record.slug,
    name: record.name,
    location: record.location,
    status: record.status,
    meta: record.meta,
    price: record.price,
    description: record.description,
    intro: record.intro,
    highlights: record.highlights,
    specs: record.specs,
    amenities: record.amenities,
    image: card ? mediaSrc(card.r2Key) : "",
    hero: {
      // A property with only a card image still needs an opening shot, and the card image is the
      // one image every published home is guaranteed to have.
      src: mediaSrc((hero ?? card)?.r2Key ?? ""),
      alt: hero?.alt || card?.alt || fallbackAlt,
    },
    gallery: gallery.map((item) => ({ src: mediaSrc(item.r2Key), alt: item.alt || fallbackAlt })),
  };
}

/** Published properties only, in grid order. Drafts are invisible here by construction. */
export async function listPublicProperties(): Promise<Property[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.published, true))
    .orderBy(asc(properties.position));

  if (rows.length === 0) return [];

  // One query for every slug's media rather than one per property: on Turso each query is a round
  // trip (spec §14), and this runs at revalidation time, not per visitor.
  const media = await db
    .select(mediaColumns)
    .from(propertyMedia)
    .where(
      inArray(
        propertyMedia.slug,
        rows.map((row) => row.slug),
      ),
    )
    .orderBy(asc(propertyMedia.role), asc(propertyMedia.position));

  const bySlug = new Map<string, MediaRecord[]>();
  for (const item of media) {
    const list = bySlug.get(item.slug) ?? [];
    list.push(item);
    bySlug.set(item.slug, list);
  }

  return rows.map((row) => toPublicProperty(toPropertyRecord(row), bySlug.get(row.slug) ?? []));
}

/** One published property by slug, for a `?property=` deep link. */
export async function getPublicProperty(slug: string): Promise<Property | undefined> {
  const properties_ = await listPublicProperties();
  return properties_.find((property) => property.slug === slug);
}
