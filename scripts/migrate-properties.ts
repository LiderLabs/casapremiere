// Seeds the catalogue from the hand-written array in lib/properties.ts into the database
// (docs/cms.md Section 11). This is what makes Phase 7 possible: `/` and `/interior`
// stop reading the array and start reading these rows.
//
//   npm run migrate:properties                 # the local file
//   npm run migrate:properties -- --dry-run    # show what would be written
//
// Image keys are the existing public paths (`/images/mono_1.jpg`). mediaSrc() passes a
// leading-slash key through untouched, so the rendered markup is byte-identical to the array
// it replaces — which is what keeps the pixel gate honest. New images uploaded in the admin
// go to R2; the old ones stay exactly where they are.
//
// Idempotent: a slug that already exists is skipped unless --replace is passed, in which case
// its row and media rows are rewritten from the array.

import { eq } from "drizzle-orm";

import { getDb, getDbClient } from "../lib/cms/db";
import { getEnv } from "../lib/cms/env";
import { properties, propertyMedia } from "../lib/cms/schema";
import { PROPERTIES, type Property } from "../lib/properties";
import { databaseLabel, loadDatabaseEnv, parseArgs } from "./cli-utils";

const ACTOR = "migrate:properties";

/** Card → hero → gallery, in the order the drawer already reads them. */
function mediaRows(property: Property) {
  const rows: {
    role: "card" | "hero" | "gallery";
    position: number;
    r2Key: string;
    alt: string;
  }[] = [];

  if (property.image) {
    rows.push({ role: "card", position: 0, r2Key: property.image, alt: `${property.name} — card` });
  }

  if (property.hero?.src) {
    rows.push({ role: "hero", position: 0, r2Key: property.hero.src, alt: property.hero.alt ?? "" });
  }

  property.gallery.forEach((image, index) => {
    rows.push({ role: "gallery", position: index, r2Key: image.src, alt: image.alt ?? "" });
  });

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDatabaseEnv(args);

  const env = getEnv();
  console.log(`[cms] database: ${databaseLabel(env.TURSO_DATABASE_URL)}`);

  const dryRun = args["dry-run"] === true;
  const replace = args.replace === true;

  const db = getDb();
  const now = new Date().toISOString();

  let created = 0;
  let skipped = 0;
  let replaced = 0;

  for (const [index, property] of PROPERTIES.entries()) {
    const [existing] = await db
      .select({ slug: properties.slug })
      .from(properties)
      .where(eq(properties.slug, property.slug))
      .limit(1);

    if (existing && !replace) {
      skipped += 1;
      console.log(`[cms] skip "${property.slug}" (already in the database)`);
      continue;
    }

    const media = mediaRows(property);
    const position = index + 1;

    console.log(
      `[cms] ${existing ? "replace" : "create"} "${property.slug}" at position ${position} with ${media.length} media row(s)`,
    );

    if (dryRun) continue;

    if (existing) {
      await db.delete(propertyMedia).where(eq(propertyMedia.slug, property.slug));
      await db.delete(properties).where(eq(properties.slug, property.slug));
    }

    await db.insert(properties).values({
      slug: property.slug,
      name: property.name,
      location: property.location,
      status: property.status,
      position,
      meta: property.meta,
      price: property.price,
      description: property.description,
      intro: JSON.stringify(property.intro),
      highlights: JSON.stringify(property.highlights),
      specs: JSON.stringify(property.specs),
      amenities: JSON.stringify(property.amenities),
      published: true,
      publishedAt: now,
      publishedBy: ACTOR,
      createdAt: now,
      updatedAt: now,
      updatedBy: ACTOR,
    });

    if (media.length > 0) {
      await db.insert(propertyMedia).values(
        media.map((item) => ({
          id: `${property.slug}-${item.role}-${item.position}`,
          slug: property.slug,
          role: item.role,
          position: item.position,
          r2Key: item.r2Key,
          alt: item.alt,
          width: null,
          height: null,
          bytes: null,
          createdAt: now,
        })),
      );
    }

    if (existing) replaced += 1;
    else created += 1;
  }

  console.log(
    `[cms] ${dryRun ? "(dry run) " : ""}created ${created} · replaced ${replaced} · skipped ${skipped}`,
  );
  getDbClient().close();
}

main().catch((error) => {
  console.error(`[cms] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
