// The CMS's data layer: every read and write that touches a content table.
//
// Route handlers validate and translate; components hold no SQL (spec Section 3); the rules that a
// second caller must not be able to skip live here:
//
// - a slug is derived from the name on create, and immutable afterwards;
// - an update carries the revision it was based on, so two editors cannot silently overwrite
//   each other (409 naming the one who saved first);
// - publish refuses a property the public card could not render (422);
// - delete keeps the whole row — and its media keys — in the audit trail, because the row is gone;
// - reorder rewrites every position in one batch, so the grid can never end up half-sorted.
//
// Server-only.

import { randomUUID } from "node:crypto";
import { and, asc, eq, max } from "drizzle-orm";

import type { SessionUser } from "@/lib/admin/auth";
import { writeAudit } from "@/lib/cms/audit";
import { getDb, getDbClient } from "@/lib/cms/db";
import { CmsError } from "@/lib/cms/errors";
import { properties, propertyMedia, settings, type PropertyRow } from "@/lib/cms/schema";
import {
  SETTING_KEYS,
  type CreatePropertyInput,
  type SettingKey,
  type UpdatePropertyInput,
  type UpdateSettingsInput,
} from "@/lib/cms/validation";
import {
  PROPERTY_DEFAULT_AMENITIES,
  PROPERTY_DEFAULT_SPECS,
  type PropertyHighlight,
  type PropertySpec,
  type PropertyStatus,
} from "@/lib/properties";

/** A property as the admin reads it: the row, with the JSON columns decoded. */
export type PropertyRecord = {
  slug: string;
  name: string;
  location: string;
  status: PropertyStatus;
  /** Grid order *and* drawer pager order. */
  position: number;
  meta: string;
  price: string;
  description: string;
  intro: string[];
  highlights: PropertyHighlight[];
  specs: PropertySpec[];
  amenities: string[];
  published: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  /** Destinations for a live home: the landing page's grid and/or the full catalogue. */
  showOnHome: boolean;
  showOnListing: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** Live, then edited since: the list's "Pending changes" badge (spec Section 7). */
  pendingChanges: boolean;
};

export type FooterLink = { label: string; href: string };
export type SettingValue = string | FooterLink[];

const nowIso = () => new Date().toISOString();

/**
 * A JSON column read back into the shape lib/properties.ts describes. A malformed value yields
 * the empty default instead of throwing: one bad row must not take the public site down.
 */
function decodeArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * `The Premier home` → `the-premier-home`. Derived on the server so the slug is never something a
 * client chooses, and stable afterwards: it is the `?property=` deep-link value and it sits in the
 * interior site's links, so a rename would break shared URLs rather than a database column.
 */
export function deriveSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || "property";
}

/** Row → record, shared with the public read path (lib/cms/public.ts). */
export function toPropertyRecord(row: PropertyRow): PropertyRecord {
  return {
    slug: row.slug,
    name: row.name,
    location: row.location,
    status: row.status,
    position: row.position,
    meta: row.meta,
    price: row.price,
    description: row.description,
    intro: decodeArray<string>(row.intro, []),
    highlights: decodeArray<PropertyHighlight>(row.highlights, []),
    specs: decodeArray<PropertySpec>(row.specs, []),
    amenities: decodeArray<string>(row.amenities, []),
    published: row.published,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    showOnHome: row.showOnHome,
    showOnListing: row.showOnListing,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    pendingChanges:
      row.published && Boolean(row.publishedAt) && row.updatedAt > (row.publishedAt as string),
  };
}

/** Every property, in grid order — drafts included, because this is the admin's view. */
export async function listProperties(): Promise<PropertyRecord[]> {
  const rows = await getDb().select().from(properties).orderBy(asc(properties.position));
  return rows.map(toPropertyRecord);
}

async function requireRow(slug: string): Promise<PropertyRow> {
  const [row] = await getDb().select().from(properties).where(eq(properties.slug, slug)).limit(1);
  if (!row) throw new CmsError(`No property with the slug "${slug}".`, 404);
  return row;
}

/** One property, or `undefined`. */
export async function getProperty(slug: string): Promise<PropertyRecord | undefined> {
  const [row] = await getDb().select().from(properties).where(eq(properties.slug, slug)).limit(1);
  return row ? toPropertyRecord(row) : undefined;
}

/**
 * What stops a property going live. A property the grid cannot render must not be published: the
 * card image is the one *media* requirement and is checked as soon as a property has any media at
 * all — before the upload pipeline exists (Phase 6) nothing could ever be published otherwise,
 * and after it every real listing has one.
 *
 * The destination rule is the other requirement: a home with both surfaces switched off would be
 * live and invisible, which is indistinguishable from a publish that failed. `placement` is the
 * caller's view of where the home should end up — the row's own flags when nobody said otherwise.
 */
async function publishBlockers(
  row: PropertyRow,
  placement: { showOnHome: boolean; showOnListing: boolean },
): Promise<string[]> {
  const missing: string[] = [];
  if (!row.name.trim()) missing.push("a name");
  if (!row.location.trim()) missing.push("a location");
  if (!placement.showOnHome && !placement.showOnListing) {
    missing.push("a destination — the home page, the listing page, or both");
  }

  const media = await listMedia(row.slug);
  const hasMedia = media.length > 0;
  const hasCard = media.some((item) => item.role === "card");
  if (hasMedia && !hasCard) missing.push("a card image");

  return missing;
}

/**
 * Both directions of the one switch, and the only writer of where a live home appears.
 *
 * `placement` is optional: absent means "leave the destinations where they are", which is what a
 * plain Publish/Unpublish from the list means. When it is present the row moves in the same
 * statement — and, crucially, *without* touching `updated_at`. Placement is not an edit, so
 * moving a home between surfaces must not raise the list's "Pending changes" badge.
 */
export async function setPublished(
  slug: string,
  published: boolean,
  actor: SessionUser,
  placement?: { showOnHome?: boolean; showOnListing?: boolean },
): Promise<PropertyRecord> {
  const row = await requireRow(slug);

  // Omitted means unchanged, so a caller that knows about one surface cannot blank the other.
  const showOnHome = placement?.showOnHome ?? row.showOnHome;
  const showOnListing = placement?.showOnListing ?? row.showOnListing;

  if (published) {
    const missing = await publishBlockers(row, { showOnHome, showOnListing });
    if (missing.length > 0) {
      throw new CmsError(`This property cannot go live yet — it needs ${missing.join(", ")}.`, 422);
    }
  }

  const now = nowIso();

  // Publishing is not an edit: `updated_at` stays where it was, so the revision an editor is
  // holding does not change under them and "pending changes" keeps meaning "edited since live".
  // Unpublishing leaves the destinations alone on purpose, so Publish puts the home back exactly
  // where it was rather than somewhere the admin has to remember to set again.
  await getDb()
    .update(properties)
    .set(
      published
        ? {
            published: true,
            publishedAt: now,
            publishedBy: actor.username,
            showOnHome,
            showOnListing,
          }
        : { published: false },
    )
    .where(eq(properties.slug, slug));

  await writeAudit({
    actor: actor.username,
    action: published ? "property.publish" : "property.unpublish",
    entity: "property",
    entityId: slug,
  });

  return toPropertyRecord(await requireRow(slug));
}

/**
 * Removes the row, its media rows and the R2 objects. The audit row keeps the whole
 * property as JSON: this is the one action with no in-app undo, so the record of it has to be
 * enough to rebuild the listing by hand.
 */
export async function deleteProperty(
  slug: string,
  actor: SessionUser,
): Promise<{ slug: string; mediaRemoved: number; r2Keys: string[] }> {
  const row = await requireRow(slug);
  const media = await listMedia(slug);

  // Explicit, in one batch: the media rows also go via ON DELETE CASCADE, but relying on a
  // foreign-key pragma that differs between a local file and Turso is not worth the risk.
  await getDbClient().batch(
    [
      { sql: "delete from property_media where slug = ?", args: [slug] },
      { sql: "delete from properties where slug = ?", args: [slug] },
    ],
    "write",
  );

  await writeAudit({
    actor: actor.username,
    action: "property.delete",
    entity: "property",
    entityId: slug,
    payload: { property: toPropertyRecord(row), media: media.map((item) => item.r2Key) },
  });

  return { slug, mediaRemoved: media.length, r2Keys: media.map((item) => item.r2Key) };
}

/**
 * The drag handle's write. All-or-nothing: every property must be present exactly once, and the
 * new order is written as one batch, so `position` is never momentarily duplicated or gapped
 * (which would reorder the grid, the drawer's pager and the shortlist differently).
 */
export async function reorderProperties(
  slugs: string[],
  actor: SessionUser,
): Promise<PropertyRecord[]> {
  const existing = await getDb().select({ slug: properties.slug }).from(properties);
  const known = new Set(existing.map((row) => row.slug));

  const unknown = slugs.filter((slug) => !known.has(slug));
  if (unknown.length > 0) throw new CmsError(`Unknown property: ${unknown.join(", ")}.`, 400);

  const missing = [...known].filter((slug) => !slugs.includes(slug));
  if (missing.length > 0) {
    throw new CmsError("Send every property in its new order — reordering is all-or-nothing.", 400);
  }

  const now = nowIso();

  await getDbClient().batch(
    slugs.map((slug, index) => ({
      sql: "update properties set position = ?, updated_at = ?, updated_by = ? where slug = ?",
      args: [index + 1, now, actor.username, slug],
    })),
    "write",
  );

  await writeAudit({
    actor: actor.username,
    action: "property.reorder",
    entity: "property",
    payload: { slugs },
  });

  return listProperties();
}

/**
 * Creates a property at the end of the grid, with the standard spec rows seeded.
 *
 * Every property starts as a draft row, and one created through "Publish now" is published in the
 * same call via `setPublished` — one code path, so a home made that way has met exactly the checks
 * a later Publish from the list would run. Draft is the only state that can fail nothing, so it is
 * the safe thing to leave behind if publishing refuses.
 */
export async function createProperty(
  input: CreatePropertyInput,
  actor: SessionUser,
): Promise<PropertyRecord> {
  const db = getDb();
  const slug = deriveSlug(input.name);

  const [clash] = await db
    .select({ slug: properties.slug })
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (clash) {
    throw new CmsError(
      `"${slug}" is already taken. Give this home a different name, or edit the existing one.`,
      409,
    );
  }

  const [highest] = await db.select({ position: max(properties.position) }).from(properties);
  const now = nowIso();

  // A draft starts from the same spec rows and amenities the three existing homes use, so a new
  // listing looks like a real one (with the drawer's "On request" grouping) from the first save.
  await db.insert(properties).values({
    slug,
    name: input.name,
    location: input.location,
    status: input.status,
    position: (highest?.position ?? 0) + 1,
    meta: input.meta,
    price: input.price,
    description: input.description,
    intro: JSON.stringify(input.intro ?? []),
    highlights: JSON.stringify(input.highlights ?? []),
    specs: JSON.stringify(input.specs ?? PROPERTY_DEFAULT_SPECS),
    amenities: JSON.stringify(input.amenities ?? PROPERTY_DEFAULT_AMENITIES),
    published: false,
    showOnHome: input.showOnHome,
    showOnListing: input.showOnListing,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor.username,
  });

  await writeAudit({
    actor: actor.username,
    action: "property.create",
    entity: "property",
    entityId: slug,
    // `intent` is recorded because it is the decision the admin actually made: "created and
    // published" and "created as a draft" are the same row and two different promises.
    payload: {
      name: input.name,
      status: input.status,
      intent: input.intent,
      showOnHome: input.showOnHome,
      showOnListing: input.showOnListing,
    },
  });

  if (input.intent === "publish") {
    // The draft row is already committed, so a refusal here (a missing card image, no destination)
    // comes back as a 422 from the create request and leaves the property on the list as a draft —
    // visible, editable, and one Publish away once the gap is filled in.
    return setPublished(slug, true, actor, {
      showOnHome: input.showOnHome,
      showOnListing: input.showOnListing,
    });
  }

  return toPropertyRecord(await requireRow(slug));
}

/**
 * A partial save against a known revision. Only real changes are written, and only the columns the
 * caller sent: the editor screen can save one section without touching the rest.
 */
export async function updateProperty(
  slug: string,
  patch: UpdatePropertyInput,
  actor: SessionUser,
): Promise<PropertyRecord> {
  const row = await requireRow(slug);

  // The precondition the editor screen relies on: `updatedAt` is the revision it loaded.
  if (patch.updatedAt !== row.updatedAt) {
    throw new CmsError("Somebody else saved this property while you were editing it.", 409, {
      changedBy: row.updatedBy || "another editor",
      changedAt: row.updatedAt,
    });
  }

  const changes: Partial<PropertyRow> = {};

  // Only real changes are written: a save that changes nothing must not appear in the audit trail
  // as an edit, and must not bump the revision other editors are holding.
  if (patch.name !== undefined && patch.name !== row.name) changes.name = patch.name;
  if (patch.location !== undefined && patch.location !== row.location) {
    changes.location = patch.location;
  }
  if (patch.status !== undefined && patch.status !== row.status) changes.status = patch.status;
  if (patch.meta !== undefined && patch.meta !== row.meta) changes.meta = patch.meta;
  if (patch.price !== undefined && patch.price !== row.price) changes.price = patch.price;
  if (patch.description !== undefined && patch.description !== row.description) {
    changes.description = patch.description;
  }

  const setJson = (
    field: "intro" | "highlights" | "specs" | "amenities",
    value: unknown[] | undefined,
  ) => {
    if (value === undefined) return;
    const serialized = JSON.stringify(value);
    if (serialized !== row[field]) changes[field] = serialized;
  };

  setJson("intro", patch.intro);
  setJson("highlights", patch.highlights);
  setJson("specs", patch.specs);
  setJson("amenities", patch.amenities);

  if (Object.keys(changes).length === 0) throw new CmsError("Nothing to update.");

  await getDb()
    .update(properties)
    .set({ ...changes, updatedAt: nowIso(), updatedBy: actor.username })
    .where(eq(properties.slug, slug));

  await writeAudit({
    actor: actor.username,
    action: "property.update",
    entity: "property",
    entityId: slug,
    payload: { fields: Object.keys(changes) },
  });

  return toPropertyRecord(await requireRow(slug));
}

// ---------------------------------------------------------------------------------------
// Media (rows + R2 objects — Phase 6: the upload pipeline)
// ---------------------------------------------------------------------------------------

export type MediaRecord = {
  id: string;
  slug: string;
  role: "card" | "hero" | "gallery";
  position: number;
  r2Key: string;
  alt: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

export type MediaRole = MediaRecord["role"];

/** The media columns every reader wants, in one place so the two selects cannot drift. */
export const mediaColumns = {
  id: propertyMedia.id,
  slug: propertyMedia.slug,
  role: propertyMedia.role,
  position: propertyMedia.position,
  r2Key: propertyMedia.r2Key,
  alt: propertyMedia.alt,
  width: propertyMedia.width,
  height: propertyMedia.height,
  bytes: propertyMedia.bytes,
};

/** A property's images, in role then position order — card, hero, then the gallery. */
export async function listMedia(slug: string): Promise<MediaRecord[]> {
  return getDb()
    .select(mediaColumns)
    .from(propertyMedia)
    .where(eq(propertyMedia.slug, slug))
    .orderBy(asc(propertyMedia.role), asc(propertyMedia.position));
}

/**
 * Records one uploaded image after the browser PUTs it to R2. Card is single: confirming a
 * second card demotes the first to gallery, so publish can always trust "the card image".
 */
export async function confirmMedia(
  slug: string,
  input: { key: string; role: MediaRole; alt: string; width?: number; height?: number; bytes?: number },
  actor: SessionUser,
): Promise<MediaRecord> {
  await requireRow(slug);

  const db = getDb();
  const now = nowIso();

  if (input.role === "card") {
    await db
      .update(propertyMedia)
      .set({ role: "gallery" })
      .where(and(eq(propertyMedia.slug, slug), eq(propertyMedia.role, "card")));
  }

  const [highest] = await db
    .select({ position: max(propertyMedia.position) })
    .from(propertyMedia)
    .where(and(eq(propertyMedia.slug, slug), eq(propertyMedia.role, input.role)));

  const [row] = await db
    .insert(propertyMedia)
    .values({
      id: randomUUID(),
      slug,
      role: input.role,
      position: (highest?.position ?? -1) + 1,
      r2Key: input.key,
      alt: input.alt,
      width: input.width ?? null,
      height: input.height ?? null,
      bytes: input.bytes ?? null,
      createdAt: now,
    })
    .returning(mediaColumns);

  if (!row) throw new CmsError("Could not record the upload.");

  await writeAudit({
    actor: actor.username,
    action: "media.confirm",
    entity: "media",
    entityId: slug,
    payload: { role: input.role, key: input.key },
  });

  return row;
}

/** Renames the role or the alt text of one image (card stays single on role change). */
export async function updateMedia(
  id: string,
  patch: { role?: MediaRole; alt?: string },
  actor: SessionUser,
): Promise<MediaRecord> {
  const db = getDb();
  const [target] = await db.select().from(propertyMedia).where(eq(propertyMedia.id, id)).limit(1);
  if (!target) throw new CmsError("No such image.", 404);

  if (patch.role === "card" && target.role !== "card") {
    await db
      .update(propertyMedia)
      .set({ role: "gallery" })
      .where(and(eq(propertyMedia.slug, target.slug), eq(propertyMedia.role, "card")));
  }

  const [row] = await db
    .update(propertyMedia)
    .set({ ...(patch.role ? { role: patch.role } : {}), ...(patch.alt !== undefined ? { alt: patch.alt } : {}) })
    .where(eq(propertyMedia.id, id))
    .returning(mediaColumns);

  if (!row) throw new CmsError("No such image.", 404);

  await writeAudit({
    actor: actor.username,
    action: "media.update",
    entity: "media",
    entityId: target.slug,
    payload: { id, patch },
  });

  return row;
}

/**
 * Removes one image row. The R2 object is deleted by the route (lib/cms/r2.ts), because only
 * the route layer may hold the storage client next to the database handle.
 */
export async function deleteMediaRow(id: string, actor: SessionUser): Promise<{ slug: string; r2Key: string }> {
  const db = getDb();
  const [target] = await db.select().from(propertyMedia).where(eq(propertyMedia.id, id)).limit(1);
  if (!target) throw new CmsError("No such image.", 404);

  await db.delete(propertyMedia).where(eq(propertyMedia.id, id));

  await writeAudit({
    actor: actor.username,
    action: "media.delete",
    entity: "media",
    entityId: target.slug,
    payload: { id, key: target.r2Key },
  });

  return { slug: target.slug, r2Key: target.r2Key };
}

/**
 * The card (or, failing that, hero) key for every property — one query for the admin list's
 * thumbnails, so the list does not ask the database once per row (spec Section 14).
 */
export async function listThumbnailKeys(): Promise<Record<string, string>> {
  const rows = await getDb()
    .select({
      slug: propertyMedia.slug,
      role: propertyMedia.role,
      r2Key: propertyMedia.r2Key,
      position: propertyMedia.position,
    })
    .from(propertyMedia)
    .orderBy(asc(propertyMedia.slug), asc(propertyMedia.position));

  const keys: Record<string, string> = {};

  for (const row of rows) {
    const current = keys[row.slug];
    if (!current || row.role === "card") keys[row.slug] = row.r2Key;
  }

  return keys;
}

// ---------------------------------------------------------------------------------------
// Business settings
// ---------------------------------------------------------------------------------------

function decodeSetting(key: SettingKey, value: string): SettingValue {
  if (key !== "footerLinks") return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as FooterLink[]) : [];
  } catch {
    return [];
  }
}

/**
 * Only what has been saved — an unset key is absent, so a reader can fall back to the value that
 * is still hard-coded in lib/booking.ts / lib/forms.ts rather than to a blank.
 */
export async function getSettings(): Promise<Partial<Record<SettingKey, SettingValue>>> {
  const rows = await getDb().select().from(settings);
  const result: Partial<Record<SettingKey, SettingValue>> = {};

  for (const row of rows) {
    if (!SETTING_KEYS.includes(row.key as SettingKey)) continue;
    const key = row.key as SettingKey;
    result[key] = decodeSetting(key, row.value);
  }

  return result;
}

/** Upserts the keys the caller sent, in one batch, and audits which ones changed. */
export async function saveSettings(
  input: UpdateSettingsInput,
  actor: SessionUser,
): Promise<Partial<Record<SettingKey, SettingValue>>> {
  const entries = SETTING_KEYS.filter((key) => input[key] !== undefined).map((key) => {
    const value = input[key] as SettingValue;
    return { key, value: typeof value === "string" ? value : JSON.stringify(value) };
  });

  if (entries.length === 0) throw new CmsError("Nothing to save.");

  const now = nowIso();

  await getDbClient().batch(
    entries.map((entry) => ({
      sql:
        "insert into settings (key, value, updated_at, updated_by) values (?, ?, ?, ?) " +
        "on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at, " +
        "updated_by = excluded.updated_by",
      args: [entry.key, entry.value, now, actor.username],
    })),
    "write",
  );

  await writeAudit({
    actor: actor.username,
    action: "settings.update",
    entity: "settings",
    payload: { keys: entries.map((entry) => entry.key) },
  });

  return getSettings();
}

