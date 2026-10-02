"use client";

// The last look before publishing (docs/cms-build-spec.md §7.1): the card as the grids draw it and
// the listing as the quick view reads it, both rendered from the editor's *unsaved* state. The
// question this dialog answers is "is what I am about to save the thing I want?", which is not a
// question the last saved revision can answer.
//
// Nothing here is a second implementation: the card is PropertyCardView and the listing is
// PropertyDetail, the same two components `/`, `/properties` and the drawer use. The checks it
// lists are the ones queries.publishBlockers runs server-side — shown here so a 422 is never the
// first news of them.
//
// It is a preview and not a publish: nothing in this file writes.

import { useState } from "react";
import { Eye } from "lucide-react";

import { PropertyCardView } from "@/components/property/property-card-view";
import { PropertyDetail } from "@/components/property/property-detail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mediaSrcClient } from "@/lib/cms/public-client";
import type { MediaRecord } from "@/lib/cms/queries";
import {
  toPropertyImages,
  type Property,
  type PropertyHighlight,
  type PropertySpec,
  type PropertyStatus,
} from "@/lib/properties";

/**
 * The editor's unsaved content, in the shape the two views consume. Deliberately not a
 * `PropertyRecord`: that type is a row (positions, timestamps, who last saved) and none of it
 * belongs in a preview.
 */
export type PreviewDraft = {
  name: string;
  location: string;
  status: PropertyStatus;
  meta: string;
  price: string;
  description: string;
  intro: string[];
  highlights: PropertyHighlight[];
  specs: PropertySpec[];
  amenities: string[];
};

export function PropertyPreview({
  slug,
  draft,
  media,
  publicBaseUrl,
  dirty,
  showOnHome,
  showOnListing,
  initialOpen = false,
}: {
  slug: string;
  /** What the editor currently holds, saved or not. */
  draft: PreviewDraft;
  media: MediaRecord[];
  publicBaseUrl?: string;
  /** True while any section differs from the saved revision — the dialog says so when it is. */
  dirty: boolean;
  showOnHome: boolean;
  showOnListing: boolean;
  /** `?preview=1` opens this on load; the button below opens it any time. */
  initialOpen?: boolean;
}) {
  const [tab, setTab] = useState("card");

  // The same rule the public read path applies to media rows (lib/properties.ts), with this
  // client's URL resolution — so the preview cannot disagree with the site about which image is
  // the card or the opening shot.
  const fallbackAlt = [draft.name, draft.location].filter(Boolean).join(", ") || "This home";
  const images = toPropertyImages(
    media,
    (key) => mediaSrcClient(key, publicBaseUrl),
    fallbackAlt,
  );

  const property: Property = {
    // Only ever a React key on the public side; a preview has no grid position to be faithful to.
    id: 0,
    slug,
    ...draft,
    ...images,
  };

  // The client's copy of publishBlockers (lib/cms/queries.ts). Kept next to the button that acts
  // on it rather than derived from the API, because the editor should warn before the round trip.
  const blockers: string[] = [];
  if (!draft.name.trim()) blockers.push("a name");
  if (!draft.location.trim()) blockers.push("a location");
  if (media.length > 0 && !media.some((item) => item.role === "card")) {
    blockers.push("a card image");
  }
  if (!showOnHome && !showOnListing) {
    blockers.push("a destination — the home page, the listing page, or both");
  }

  const destination = showOnHome && showOnListing
    ? "the landing page and the properties page"
    : showOnHome
      ? "the landing page only"
      : showOnListing
        ? "the properties page only"
        : "nowhere yet";

  return (
    <Dialog defaultOpen={initialOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Eye className="size-4" aria-hidden="true" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview — {draft.name || "this home"}</DialogTitle>
          <DialogDescription>
            The card and the listing as a visitor would see them, on {slug}.
            {dirty
              ? " Unsaved changes are included: this is the editor's current state, not the last save."
              : " This matches the last save."}
          </DialogDescription>
        </DialogHeader>
        {blockers.length > 0 ? (
          <div
            role="status"
            className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm"
          >
            <p className="font-medium text-foreground">Not publishable yet</p>
            <p className="mt-1 text-muted-foreground">
              Publishing will be refused until this home has {blockers.join(", ")}.
            </p>
          </div>
        ) : (
          <div role="status" className="rounded-lg border border-border px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Ready to publish</p>
            <p className="mt-1 text-muted-foreground">
              It would go live on {destination}.
            </p>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="card">Grid card</TabsTrigger>
            <TabsTrigger value="detail">Listing</TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="pt-4">
            <p className="mb-4 text-xs text-muted-foreground">
              The landing page&apos;s carousel and the catalogue grid draw this card. Click it to
              see the whole listing.
            </p>
            <div className="max-w-xs">
              <PropertyCardView property={property} onOpen={() => setTab("detail")} />
            </div>
            {property.image ? null : (
              <p className="mt-2 text-xs text-muted-foreground">
                No card image, so the grid would fall back to its placeholder.
              </p>
            )}
          </TabsContent>

          <TabsContent value="detail" className="pt-4">
            <p className="mb-6 text-xs text-muted-foreground">
              The quick view&apos;s content. The shortlist heart, the viewing hand-off, the
              affordability calculator and the interiors cross-sell are live-site only, so they are
              not part of this preview.
            </p>
            <PropertyDetail property={property} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <p className="flex-1 text-left text-xs text-muted-foreground">
            Previewing {media.length} image{media.length === 1 ? "" : "s"}. Nothing here is saved by
            opening it.
          </p>
          <DialogClose asChild>
            <Button type="button" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}