"use client";

// The property editor (docs/cms-build-spec.md §7.1): one Card per part of the Property
// shape, saving one section at a time against the revision it loaded (the `updatedAt`
// precondition → 409 naming the other editor). Dirty tracking, an unsaved-changes guard
// and a publish confirmation dialog are the speed bumps before something goes live.
//
// Each save is a toast on success or failure; the Publishing card stays the persistent
// state line (Live / Draft / pending / blocked). Media uploads live in the Media card from
// Phase 6 (the R2 pipeline): browser resize → presigned PUT → confirm row, with role, alt
// text and delete. Replacing an image is uploading the new one then deleting the old, so the
// property never loses its card image in between.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HIGHLIGHT_ICONS } from "@/components/property/property-detail";
import { formatAccra } from "@/lib/admin/format";
import { placementLabel } from "@/lib/cms/placement";
import type { MediaRecord, PropertyRecord } from "@/lib/cms/queries";
import {
  PROPERTY_DEFAULT_AMENITIES,
  PROPERTY_DEFAULT_SPECS,
  PROPERTY_HIGHLIGHT_ICONS,
  PROPERTY_STATUSES,
  type PropertyHighlight,
  type PropertyHighlightIcon,
  type PropertySpec,
  type PropertyStatus,
} from "@/lib/properties";

import { MediaManager } from "./media-manager";
import { PropertyPreview, type PreviewDraft } from "./property-preview";

type Role = "admin" | "editor";

type ApiPayload = {
  error?: string;
  property?: PropertyRecord;
  changedBy?: string;
  changedAt?: string;
  mediaRemoved?: number;
  revalidated?: string[];
};

async function saveProperty(
  slug: string,
  body: Record<string, unknown>,
): Promise<PropertyRecord> {
  const response = await fetch(`/api/admin/properties/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as ApiPayload;

  if (!response.ok) {
    const conflict =
      data.changedBy || data.changedAt
        ? ` Changed by ${data.changedBy ?? "another editor"}${data.changedAt ? ` at ${data.changedAt}` : ""}. Reload to see their version.`
        : "";
    throw new Error(`${data.error ?? "Could not save the property."}${conflict}`);
  }

  if (!data.property) throw new Error("The server did not return the property.");
  return data.property;
}

/**
 * Publish or unpublish. `placement` travels with a publish and only with a publish: it is how the
 * editor moves a home between the landing page and the catalogue without a PATCH — see
 * lib/cms/queries.ts, setPublished, for why that matters (the "Pending changes" badge).
 */
async function setLive(
  slug: string,
  live: boolean,
  placement?: { showOnHome: boolean; showOnListing: boolean },
): Promise<PropertyRecord> {
  const response = await fetch(`/api/admin/properties/${slug}/${live ? "publish" : "unpublish"}`, {
    method: "POST",
    headers: placement ? { "Content-Type": "application/json" } : undefined,
    body: placement ? JSON.stringify(placement) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as ApiPayload;

  if (!response.ok) throw new Error(data.error ?? "That request failed. Please try again.");
  if (!data.property) throw new Error("The server did not return the property.");
  return data.property;
}

function joinLines(list: string[]): string {
  return list.join("\n");
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function PropertyEditor({
  property: initial,
  media,
  role,
  publicBaseUrl,
  initialPreviewOpen = false,
}: {
  property: PropertyRecord;
  media: MediaRecord[];
  role: Role;
  publicBaseUrl?: string;
  /** `?preview=1` on the editor's URL opens the pre-publish preview as the page loads. */
  initialPreviewOpen?: boolean;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";

  /**
   * The list sends a newly created property to `#media` (properties-manager.tsx), because the card
   * image is the one thing every new home still needs. A browser only honours a fragment on a full
   * page load, and arriving here is a client-side transition, so the fragment is applied by hand.
   * The hash stays in the URL either way, so a reload or a shared link still lands correctly.
   */
  useEffect(() => {
    if (window.location.hash !== "#media") return;
    document.getElementById("media")?.scrollIntoView({ block: "start" });
  }, []);

  const [property, setProperty] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  const [basics, setBasics] = useState({
    name: initial.name,
    location: initial.location,
    status: initial.status,
    meta: initial.meta,
    price: initial.price,
    description: initial.description,
  });
  const [intro, setIntro] = useState(joinLines(initial.intro));
  // Structured rows, not `icon | title | description` lines: these are the shapes the drawer
  // renders, so the editor cannot offer a combination the public site has no rule for.
  const [highlights, setHighlights] = useState<PropertyHighlight[]>(initial.highlights);
  const [specs, setSpecs] = useState<PropertySpec[]>(initial.specs);
  const [amenities, setAmenities] = useState<string[]>(initial.amenities);
  // Where this home should appear. Local state, so a checkbox can be moved and published in one
  // action — and so a placement change that has not been saved yet reads as one.
  const [destinations, setDestinations] = useState({
    showOnHome: initial.showOnHome,
    showOnListing: initial.showOnListing,
  });

  const dirtyBasics =
    basics.name !== property.name ||
    basics.location !== property.location ||
    basics.status !== property.status ||
    basics.meta !== property.meta ||
    basics.price !== property.price ||
    basics.description !== property.description;

  // Rows the editor is only holding because "Add row" was pressed are dropped rather than sent: an
  // empty row is not a broken row, it is a row nobody filled in. A partly filled one is kept, so
  // the message the admin reads is the schema's own ("Describe the highlight.") rather than a
  // silent omission.
  const cleanHighlights = highlights.filter(
    (item) => item.title.trim() !== "" || item.description.trim() !== "",
  );
  const cleanSpecs = specs.filter((item) => item.label.trim() !== "");
  const cleanAmenities = Array.from(
    new Set(amenities.map((item) => item.trim()).filter((item) => item !== "")),
  );

  const dirtyIntro = intro !== joinLines(property.intro);
  const dirtyHighlights =
    JSON.stringify(cleanHighlights) !== JSON.stringify(property.highlights);
  const dirtySpecs =
    JSON.stringify(cleanSpecs) !== JSON.stringify(property.specs) ||
    JSON.stringify(cleanAmenities) !== JSON.stringify(property.amenities);

  // Each section's own button follows its own flag: with rows instead of one textarea, a save that
  // changes nothing is now easy to press by accident, and the API answers that with 400 "Nothing
  // to update." — a button that is off is a better answer.
  const dirtySections = dirtyIntro || dirtyHighlights || dirtySpecs;

  /** Any unsaved edit anywhere — what the preview's "unsaved changes are included" line reads. */
  const dirty = dirtyBasics || dirtySections;

  /**
   * A destination moved but not published. Placements are written by publishing, never by a PATCH:
   * a partial save bumps `updated_at`, which is exactly what raises the list's "Pending changes"
   * badge — and moving a home between surfaces is not unpublished content.
   */
  const placementDirty =
    destinations.showOnHome !== property.showOnHome ||
    destinations.showOnListing !== property.showOnListing;

  async function run(section: string, fn: () => Promise<PropertyRecord>) {
    setSaving(section);
    try {
      const next = await fn();
      setProperty(next);
      toast.success(`${section} saved at ${formatAccra(next.updatedAt)} by ${next.updatedBy}.`);
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not save the property.");
    } finally {
      setSaving(null);
    }
  }

  // -------------------------------------------------------------------------------------
  // Repeatable rows — highlights, specs, amenities
  //
  // Each list is edited as rows rather than as a textarea of `|`-separated lines. The shapes
  // below are lib/properties.ts's own: `PropertyHighlight` pins the icon to the six keys the
  // drawer can draw, and `PropertySpec` is what the schema validates, so a row cannot be typed
  // into a state the server would refuse for a reason the admin cannot see.
  // -------------------------------------------------------------------------------------

  function updateHighlight(index: number, patch: Partial<PropertyHighlight>) {
    setHighlights((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }

  function addHighlight() {
    setHighlights((current) => [
      ...current,
      { icon: PROPERTY_HIGHLIGHT_ICONS[0], title: "", description: "" },
    ]);
  }

  function removeHighlight(index: number) {
    setHighlights((current) => current.filter((_, position) => position !== index));
  }

  function updateSpec(index: number, patch: Partial<PropertySpec>) {
    setSpecs((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }

  function addSpec() {
    setSpecs((current) => [...current, { label: "", value: "" }]);
  }

  function removeSpec(index: number) {
    setSpecs((current) => current.filter((_, position) => position !== index));
  }

  function updateAmenity(index: number, value: string) {
    setAmenities((current) => current.map((item, position) => (position === index ? value : item)));
  }

  function addAmenity() {
    setAmenities((current) => [...current, ""]);
  }

  function removeAmenity(index: number) {
    setAmenities((current) => current.filter((_, position) => position !== index));
  }

  const card = media.find((item) => item.role === "card");
  const hasMediaWithoutCard = media.length > 0 && !card;

  /**
   * What the preview renders: the editor's current state, not the saved row. The point of a last
   * look before publishing is to see the thing about to be published, which is why the dialog says
   * when unsaved changes are included.
   */
  const previewDraft: PreviewDraft = {
    name: basics.name,
    location: basics.location,
    status: basics.status,
    meta: basics.meta,
    price: basics.price,
    description: basics.description,
    intro: splitLines(intro),
    highlights: cleanHighlights,
    specs: cleanSpecs,
    amenities: cleanAmenities,
  };

  async function remove() {
    const response = await fetch(`/api/admin/properties/${property.slug}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as ApiPayload;
    if (!response.ok) throw new Error(data.error ?? "Could not delete the property.");
    router.replace("/admin/properties");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Publishing</CardTitle>
              <CardDescription aria-live="polite" className="max-w-prose">
                {property.published
                  ? `Live${property.publishedAt ? ` since ${formatAccra(property.publishedAt)}${property.publishedBy ? ` by ${property.publishedBy}` : ""}` : ""}${property.pendingChanges ? " · edited since — publish pending" : ""}`
                  : "Draft — invisible on / and /interior until published."}
                {" "}
                {property.published ? "Shown on" : "Will publish to"}{" "}
                {placementLabel(destinations)}.
                {hasMediaWithoutCard
                  ? " Publishing is blocked until one image is the card image."
                  : ""}
                {!destinations.showOnHome && !destinations.showOnListing
                  ? " Publishing is blocked while both destinations are off."
                  : ""}
              </CardDescription>
            </div>
            <Badge
              variant={
                property.pendingChanges ? "outline" : property.published ? "default" : "secondary"
              }
            >
              {property.pendingChanges ? "Pending" : property.published ? "Live" : "Draft"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Publish to</legend>
            <div className="flex flex-wrap gap-4">
              <label htmlFor="publish-home" className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="publish-home"
                  checked={destinations.showOnHome}
                  onCheckedChange={(checked) =>
                    setDestinations((current) => ({ ...current, showOnHome: checked === true }))
                  }
                />
                Landing page
              </label>
              <label htmlFor="publish-listing" className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="publish-listing"
                  checked={destinations.showOnListing}
                  onCheckedChange={(checked) =>
                    setDestinations((current) => ({ ...current, showOnListing: checked === true }))
                  }
                />
                Properties page
              </label>
            </div>
            {/* Destinations are saved by publishing, never by a partial save: a PATCH bumps the
                revision, and the revision is what the list reads as "Pending changes" — moving a
                home between surfaces is not unpublished content (lib/cms/queries.ts). */}
            <p className="text-xs text-muted-foreground">
              A live home has to appear somewhere. Both off is refused at publish time, and the
              preview says so before you send it.
            </p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
          {property.published ? (
            <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving !== null}
              onClick={() => run("Unpublish", () => setLive(property.slug, false))}
            >
              Unpublish
            </Button>
            {/* A placement change on a live home is saved by publishing it again, not by a save:
                it goes nowhere near `updated_at`, so the list keeps saying "Live" rather than
                raising a "Pending" badge for content that has not changed. */}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={saving !== null || !placementDirty}
              onClick={() => run("Publish", () => setLive(property.slug, true, destinations))}
            >
              {saving === "Publish" ? "Saving…" : "Save destinations"}
            </Button>
            </>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" disabled={saving !== null}>
                  Publish…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publish {property.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It appears on {placementLabel(destinations)} in seconds. Unpublish is the undo.
                    {!destinations.showOnHome && !destinations.showOnListing
                      ? " Choose at least one destination first: a home with nowhere to appear cannot be published."
                      : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!destinations.showOnHome && !destinations.showOnListing}
                    onClick={() =>
                      run("Publish", () => setLive(property.slug, true, destinations))
                    }
                  >
                    Publish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

            {/* The last look before publishing, rendered from the state above rather than from the
                saved row. `?preview=1` opens it straight away (see the page's searchParams). */}
            <PropertyPreview
              slug={property.slug}
              draft={previewDraft}
              media={media}
              publicBaseUrl={publicBaseUrl}
              dirty={dirty}
              showOnHome={destinations.showOnHome}
              showOnListing={destinations.showOnListing}
              initialOpen={initialPreviewOpen}
            />

          {isAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving !== null}
                  className="text-destructive hover:text-destructive"
                >
                  Delete…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {property.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <span className="font-mono">{property.slug}</span> to confirm. The audit
                    row keeps the full JSON.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmDelete}
                  onChange={(event) => setConfirmDelete(event.target.value)}
                  placeholder={property.slug}
                  autoComplete="off"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmDelete("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmDelete.trim() !== property.slug}
                    onClick={() =>
                      run("Delete", async () => {
                        await remove();
                        return property;
                      })
                    }
                  >
                    Delete property
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>
            The slug was derived from the name when the draft was created and is permanent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="basics-name">Name</Label>
              <Input
                id="basics-name"
                value={basics.name}
                onChange={(event) =>
                  setBasics((current) => ({ ...current, name: event.target.value }))
                }
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="basics-location">Location</Label>
              <Input
                id="basics-location"
                value={basics.location}
                onChange={(event) =>
                  setBasics((current) => ({ ...current, location: event.target.value }))
                }
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="basics-status">Status</Label>
              <Select
                value={basics.status}
                onValueChange={(value) =>
                  setBasics((current) => ({ ...current, status: value as PropertyStatus }))
                }
              >
                <SelectTrigger id="basics-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="basics-price">Price</Label>
              <Input
                id="basics-price"
                value={basics.price}
                onChange={(event) =>
                  setBasics((current) => ({ ...current, price: event.target.value }))
                }
                maxLength={120}
              />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="basics-meta">Card line</Label>
              <Input
                id="basics-meta"
                value={basics.meta}
                onChange={(event) =>
                  setBasics((current) => ({ ...current, meta: event.target.value }))
                }
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="basics-description">Card description</Label>
              <Textarea
                id="basics-description"
                value={basics.description}
                onChange={(event) =>
                  setBasics((current) => ({ ...current, description: event.target.value }))
                }
                maxLength={600}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button
            type="button"
            size="sm"
            disabled={!dirtyBasics || saving !== null}
            onClick={() =>
              run("Basics", () =>
                saveProperty(property.slug, { ...basics, updatedAt: property.updatedAt }),
              )
            }
          >
            {saving === "Basics" ? "Saving…" : "Save basics"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intro</CardTitle>
          <CardDescription>One paragraph per line.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
            rows={5}
          />
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button
            type="button"
            size="sm"
            disabled={!dirtyIntro || saving !== null}
            onClick={() =>
              run("Intro", () =>
                saveProperty(property.slug, { intro: splitLines(intro), updatedAt: property.updatedAt }),
              )
            }
          >
            {saving === "Intro" ? "Saving…" : "Save intro"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Highlights</CardTitle>
          <CardDescription>
            An icon, a title and a sentence each. The icons are the six the drawer can draw, so a
            highlight cannot be saved into a shape the public site has no rendering for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No highlights yet — add one and the drawer grows a block for it.
            </p>
          ) : null}

          {highlights.map((highlight, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[11rem_1fr_auto]"
            >
              <div className="grid content-start gap-1.5">
                <Label htmlFor={`highlight-icon-${index}`}>Icon</Label>
                <Select
                  value={highlight.icon}
                  onValueChange={(value) =>
                    updateHighlight(index, { icon: value as PropertyHighlightIcon })
                  }
                >
                  <SelectTrigger id={`highlight-icon-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* The glyph and the key: the admin is choosing what a visitor will see, and
                        `HIGHLIGHT_ICONS` is the drawer's own map (components/property/
                        property-detail.tsx), so this menu cannot offer an icon nothing can draw. */}
                    {PROPERTY_HIGHLIGHT_ICONS.map((icon) => {
                      const Icon = HIGHLIGHT_ICONS[icon];
                      return (
                        <SelectItem key={icon} value={icon}>
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" aria-hidden="true" />
                            {icon}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`highlight-title-${index}`}>Title</Label>
                <Input
                  id={`highlight-title-${index}`}
                  value={highlight.title}
                  onChange={(event) => updateHighlight(index, { title: event.target.value })}
                  placeholder="Natural light"
                  maxLength={80}
                />
                <Textarea
                  aria-label={`Description for highlight ${index + 1}`}
                  value={highlight.description}
                  onChange={(event) =>
                    updateHighlight(index, { description: event.target.value })
                  }
                  placeholder="A plan that keeps every principal room bright."
                  rows={2}
                  maxLength={240}
                />
              </div>

              <div className="flex items-start justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeHighlight(index)}
                  aria-label={`Remove highlight ${index + 1}`}
                  title="Remove highlight"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addHighlight}>
            <Plus className="size-4" aria-hidden="true" />
            Add highlight
          </Button>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button
            type="button"
            size="sm"
            disabled={!dirtyHighlights || saving !== null}
            onClick={() =>
              run("Highlights", () =>
                saveProperty(property.slug, {
                  highlights: cleanHighlights,
                  updatedAt: property.updatedAt,
                }),
              )
            }
          >
            {saving === "Highlights" ? "Saving…" : "Save highlights"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Specs and amenities</CardTitle>
          <CardDescription>
            Specs are a label and a value — a row left without a value is grouped into “On request”
            by the drawer, which is a legitimate state, not an unfinished one. Amenities are single
            entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Specs</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSpec}>
                <Plus className="size-4" aria-hidden="true" />
                Add spec
              </Button>
            </div>
            {/* The rows the three existing homes use, offered as suggestions rather than a fixed
                list: the schema accepts any label, and a spec nobody thought of is a valid one. */}
            <datalist id="spec-label-options">
              {PROPERTY_DEFAULT_SPECS.map((spec) => (
                <option key={spec.label} value={spec.label} />
              ))}
            </datalist>

            {specs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spec rows yet.</p>
            ) : null}

            {specs.map((spec, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Input
                    list="spec-label-options"
                    value={spec.label}
                    onChange={(event) => updateSpec(index, { label: event.target.value })}
                    placeholder="Bedrooms"
                    aria-label={`Spec ${index + 1} label`}
                    maxLength={60}
                  />
                  <Input
                    value={spec.value}
                    onChange={(event) => updateSpec(index, { value: event.target.value })}
                    placeholder="Leave empty for “On request”"
                    aria-label={`Spec ${index + 1} value`}
                    maxLength={120}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeSpec(index)}
                  aria-label={`Remove spec ${index + 1}`}
                  title="Remove spec"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Amenities</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAmenity}>
                <Plus className="size-4" aria-hidden="true" />
                Add amenity
              </Button>
            </div>
            <datalist id="amenity-options">
              {PROPERTY_DEFAULT_AMENITIES.map((amenity) => (
                <option key={amenity} value={amenity} />
              ))}
            </datalist>

            {amenities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amenities yet.</p>
            ) : null}

            {amenities.map((amenity, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  list="amenity-options"
                  value={amenity}
                  onChange={(event) => updateAmenity(index, event.target.value)}
                  placeholder="Landscaped garden"
                  aria-label={`Amenity ${index + 1}`}
                  maxLength={80}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAmenity(index)}
                  aria-label={`Remove amenity ${index + 1}`}
                  title="Remove amenity"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button
            type="button"
            size="sm"
            disabled={!dirtySpecs || saving !== null}
            onClick={() =>
              run("Specs", () =>
                saveProperty(property.slug, {
                  specs: cleanSpecs,
                  amenities: cleanAmenities,
                  updatedAt: property.updatedAt,
                }),
              )
            }
          >
            {saving === "Specs" ? "Saving…" : "Save specs"}
          </Button>
        </CardFooter>
      </Card>

      {/* `#media` is where the property list sends a newly created home (properties-manager.tsx),
          and `scroll-mt-20` clears the sticky topbar (h-14) plus the shell's top padding so the
          heading is not hidden under it when the fragment is applied. */}
      <Card id="media" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Media · {media.length}</CardTitle>
          <CardDescription>
            Images are resized to WebP in the browser before upload. One image must be the card
            image before the property can publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaManager slug={property.slug} media={media} publicBaseUrl={publicBaseUrl} />
        </CardContent>
      </Card>
    </div>
  );
}

