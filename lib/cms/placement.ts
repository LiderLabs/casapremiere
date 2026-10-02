// Where a live home appears, in words.
//
// Placement is an admin idea: the public `Property` type (lib/properties.ts) deliberately has no
// field for it, so a component can never start branching on where a home is shown — only whether
// it is in the list it was handed. The three admin surfaces that *do* name it (the catalogue list,
// the editor's Publishing card and the pre-publish preview) share this file so a home kept off one
// surface is described the same way in all three.
//
// Client-safe: no imports, no database, no env.

export type Placement = { showOnHome: boolean; showOnListing: boolean };

export function placementLabel(placement: Placement): string {
  if (placement.showOnHome && placement.showOnListing) {
    return "the landing page and the properties page";
  }
  if (placement.showOnHome) return "the landing page only";
  if (placement.showOnListing) return "the properties page only";
  return "nowhere yet";
}