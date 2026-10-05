// Keeping `/`, `/properties` and `/interior` fresh (docs/cms.md D6).
//
// Phase 7 made the public routes read the database at revalidation time, which widens the
// promise from "a publish is live in seconds" to "anything that changes what a visitor sees
// is live in seconds". Publish was the only writer that used to matter; now a price edit on
// an already live home, a new card image, a delete or a reorder all change the rendered page.
//
// One list and one call, so no route can revalidate half the site and leave the other half
// stale. A new public route has exactly one place to be added: here. Next only permits this
// from a route handler or a server action — where every call site lives.
//
// Business settings are deliberately absent: they are still admin-only values that the public
// pages hard-code, so a settings save has nothing to invalidate yet. When the footer reads them
// (a later phase), this helper is the one place that has to learn about it.

import { revalidatePath } from "next/cache";

/** Every route a content change refreshes — the public promise of D6. */
export const PUBLISHED_PATHS = ["/", "/properties", "/interior"] as const;

/**
 * Invalidate every public route. Called *after* the write succeeds, never before: a failed
 * write must not cost a visitor a regeneration.
 */
export function revalidatePublishedPages(): readonly string[] {
  for (const path of PUBLISHED_PATHS) revalidatePath(path);
  return PUBLISHED_PATHS;
}
