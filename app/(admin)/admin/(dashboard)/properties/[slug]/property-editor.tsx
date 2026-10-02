"use client";

// The property editor (docs/cms-build-spec.md §7.1): one section per part of the Property
// shape, saving one section at a time against the revision it loaded (the `updatedAt`
// precondition → 409 naming the other editor). Dirty tracking, an unsaved-changes guard
// and a publish confirmation dialog are the speed bumps before something goes live.
//
// Media uploads live here from Phase 6 (the R2 pipeline): browser resize → presigned PUT →
// confirm row, with role, alt text and delete. Replacing an image is uploading the new one
// then deleting the old, so the property never loses its card image in between.

import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { Button } from "@/components/ui/button";
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
import { formatAccra } from "@/lib/admin/format";
import type { MediaRecord, PropertyRecord } from "@/lib/cms/queries";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/properties";

import { MediaManager } from "./media-manager";

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

async function setLive(slug: string, live: boolean): Promise<PropertyRecord> {
  const response = await fetch(`/api/admin/properties/${slug}/${live ? "publish" : "unpublish"}`, {
    method: "POST",
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
}: {
  property: PropertyRecord;
  media: MediaRecord[];
  role: Role;
  publicBaseUrl?: string;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";

  const [property, setProperty] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [highlights, setHighlights] = useState(
    joinLines(initial.highlights.map((item) => `${item.icon} | ${item.title} | ${item.description}`)),
  );
  const [specs, setSpecs] = useState(
    joinLines(initial.specs.map((item) => `${item.label} | ${item.value}`)),
  );
  const [amenities, setAmenities] = useState(joinLines(initial.amenities));

  const dirtyBasics =
    basics.name !== property.name ||
    basics.location !== property.location ||
    basics.status !== property.status ||
    basics.meta !== property.meta ||
    basics.price !== property.price ||
    basics.description !== property.description;

  async function run(section: string, fn: () => Promise<PropertyRecord>) {
    setSaving(section);
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      setProperty(next);
      setNotice(`${section} saved at ${formatAccra(next.updatedAt)} by ${next.updatedBy}.`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the property.");
    } finally {
      setSaving(null);
    }
  }

  function parseHighlights(value: string) {
    return splitLines(value).map((line) => {
      const [icon = "", title = "", ...rest] = line.split("|").map((part) => part.trim());
      return { icon, title, description: rest.join(" | ") };
    });
  }

  function parseSpecs(value: string) {
    return splitLines(value).map((line) => {
      const [label = "", ...rest] = line.split("|").map((part) => part.trim());
      return { label, value: rest.join(" | ") };
    });
  }

  const card = media.find((item) => item.role === "card");
  const hasMediaWithoutCard = media.length > 0 && !card;

  async function remove() {
    const response = await fetch(`/api/admin/properties/${property.slug}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as ApiPayload;
    if (!response.ok) throw new Error(data.error ?? "Could not delete the property.");
    router.replace("/admin/properties");
    router.refresh();
  }
  return (
    <div className="mt-8 space-y-6">
      {notice ? (
        <p role="status" className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/40 px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <section aria-live="polite" className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Status</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {property.published
            ? `Live${property.publishedAt ? ` since ${formatAccra(property.publishedAt)}${property.publishedBy ? ` by ${property.publishedBy}` : ""}` : ""}${property.pendingChanges ? " · edited since — publish pending" : ""}`
            : "Draft — invisible on / and /interior until published."}
          {hasMediaWithoutCard
            ? " Publishing is blocked until one image is the card image."
            : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {property.published ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving !== null}
              onClick={() => run("Unpublish", () => setLive(property.slug, false))}
            >
              Unpublish
            </Button>
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
                    It appears on / and /interior in seconds. Unpublish is the undo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => run("Publish", () => setLive(property.slug, true))}
                  >
                    Publish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdmin ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={saving !== null}>
                  Delete…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {property.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <span className="font-mono">{property.slug}</span> to confirm. The
                    audit row keeps the full JSON.
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
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Basics</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="basics-name">Name</Label>
            <Input
              id="basics-name"
              value={basics.name}
              onChange={(event) => setBasics((current) => ({ ...current, name: event.target.value }))}
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
              onChange={(event) => setBasics((current) => ({ ...current, price: event.target.value }))}
              maxLength={120}
            />
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="basics-meta">Card line</Label>
            <Input
              id="basics-meta"
              value={basics.meta}
              onChange={(event) => setBasics((current) => ({ ...current, meta: event.target.value }))}
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
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={!dirtyBasics || saving !== null}
            onClick={() =>
              run("Basics", () => saveProperty(property.slug, { ...basics, updatedAt: property.updatedAt }))
            }
          >
            {saving === "Basics" ? "Saving…" : "Save basics"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Intro</h2>
        <p className="mt-1 text-xs text-muted-foreground">One paragraph per line.</p>
        <Textarea
          value={intro}
          onChange={(event) => setIntro(event.target.value)}
          rows={5}
          className="mt-3"
        />
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={saving !== null}
            onClick={() =>
              run("Intro", () =>
                saveProperty(property.slug, { intro: splitLines(intro), updatedAt: property.updatedAt }),
              )
            }
          >
            {saving === "Intro" ? "Saving…" : "Save intro"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Highlights</h2>
        <p className="mt-1 text-xs text-muted-foreground">One per line: icon | title | description.</p>
        <Textarea
          value={highlights}
          onChange={(event) => setHighlights(event.target.value)}
          rows={5}
          className="mt-3 font-mono text-xs"
        />
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={saving !== null}
            onClick={() =>
              run("Highlights", () =>
                saveProperty(property.slug, {
                  highlights: parseHighlights(highlights),
                  updatedAt: property.updatedAt,
                }),
              )
            }
          >
            {saving === "Highlights" ? "Saving…" : "Save highlights"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Specs and amenities</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Specs one per line: label | value. Amenities one per line.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Textarea
            aria-label="Specs"
            value={specs}
            onChange={(event) => setSpecs(event.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <Textarea
            aria-label="Amenities"
            value={amenities}
            onChange={(event) => setAmenities(event.target.value)}
            rows={6}
          />
        </div>
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={saving !== null}
            onClick={() =>
              run("Specs", () =>
                saveProperty(property.slug, {
                  specs: parseSpecs(specs),
                  amenities: splitLines(amenities),
                  updatedAt: property.updatedAt,
                }),
              )
            }
          >
            {saving === "Specs" ? "Saving…" : "Save specs"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">Media · {media.length}</h2>
        <MediaManager slug={property.slug} media={media} publicBaseUrl={publicBaseUrl} />
      </section>
    </div>
  );
}



