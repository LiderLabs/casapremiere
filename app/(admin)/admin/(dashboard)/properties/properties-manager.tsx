"use client";

// The property list (docs/cms-build-spec.md §7): every property in grid order, drafts
// included, with the card thumbnail, the Live / Draft / Pending badge, the last-published
// line and the row actions. Every write goes through /api/admin/properties**, where the
// role checks live — the UI hides what the API would refuse, so an editor never sees a
// delete button and an admin gets the ordering buttons and the delete dialog.
//
// Feedback is a sonner toast (the admin mounts one Toaster in app/(admin)/layout.tsx); the
// only inline message kept is the create form's error, because it belongs to the field that
// caused it. Each row is a Card that stacks on mobile and goes side-by-side from sm.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImageOff } from "lucide-react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAccra } from "@/lib/admin/format";
import { placementLabel } from "@/lib/cms/placement";
import { mediaSrcClient } from "@/lib/cms/public-client";
import type { PropertyRecord } from "@/lib/cms/queries";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/properties";

type Role = "admin" | "editor";

type ApiPayload = {
  error?: string;
  property?: PropertyRecord;
  properties?: PropertyRecord[];
  changedBy?: string;
  changedAt?: string;
  mediaRemoved?: number;
  revalidated?: string[];
};

/** One fetch shape for every endpoint: JSON in, JSON out, `{ error }` on failure. */
async function request(path: string, method: string, body?: unknown): Promise<ApiPayload> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as ApiPayload;

  if (!response.ok) {
    const conflict =
      data.changedBy || data.changedAt
        ? ` Changed by ${data.changedBy ?? "another editor"}${data.changedAt ? ` at ${data.changedAt}` : ""}.`
        : "";
    throw new Error(`${data.error ?? "That request failed. Please try again."}${conflict}`);
  }

  return data;
}

function badge(property: PropertyRecord): {
  label: string;
  variant: "default" | "secondary" | "outline";
} {
  if (property.pendingChanges) return { label: "Pending", variant: "outline" };
  if (property.published) return { label: "Live", variant: "default" };
  return { label: "Draft", variant: "secondary" };
}

/**
 * Where a live home actually appears, in the admin's own words — `placementLabel` from
 * lib/cms/placement.ts, shared with the editor's Publishing card and the pre-publish preview.
 * Two surfaces exist (`/` and `/properties`), so there are four combinations and none of them
 * should read as a bug.
 */

export function PropertiesManager({
  properties: initial,
  role,
  thumbnails = {},
  publicBaseUrl,
}: {
  properties: PropertyRecord[];
  role: Role;
  thumbnails?: Record<string, string>;
  publicBaseUrl?: string;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";

  const [properties, setProperties] = useState(initial);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  const [form, setForm] = useState({
    name: "",
    location: "",
    status: "Available" as PropertyStatus,
    /** Where it should go live. Both on, because that is what every published home did before. */
    showOnHome: true,
    showOnListing: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  /** Which button is mid-flight — the two are different promises, so the label has to match. */
  const [creating, setCreating] = useState<"publish" | "draft" | null>(null);

  async function act(slug: string, fn: () => Promise<void>) {
    setBusySlug(slug);
    try {
      await fn();
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "That request failed.");
    } finally {
      setBusySlug(null);
    }
  }

  /**
   * One form, two promises. `intent` travels with the request so the server decides between them.
   *
   * Either button ends in the editor, at the new property's media section: a home that has just
   * been created always has images to add, so the flow finishes where the next piece of work is
   * rather than back on a list where the new row has to be found. A refusal keeps the admin on this
   * form instead — a rejected create has written nothing, so there is no editor to open, and the
   * message belongs beside the field that caused it.
   */
  async function create(intent: "publish" | "draft") {
    setCreating(intent);
    setFormError(null);
    try {
      const data = await request("/api/admin/properties", "POST", {
        name: form.name,
        location: form.location,
        status: form.status,
        intent,
        showOnHome: form.showOnHome,
        showOnListing: form.showOnListing,
      });
      if (data.property) {
        const created = data.property;
        toast.success(
          intent === "publish"
            ? `"${created.name}" is live on ${placementLabel(created)}.`
            : `"${created.name}" saved as a draft — add its card image, then publish.`,
        );
        // Refresh the list we are leaving *before* pushing: Back returns to it, and the rest of
        // this file refreshes after navigating only because those screens (sign-in, delete) are
        // never returned to. `#media` is the Media card's anchor in property-editor.tsx.
        router.refresh();
        router.push(`/admin/properties/${created.slug}#media`);
        return;
      }
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "Could not create the property.";
      setFormError(message);
      toast.error(message);
    } finally {
      setCreating(null);
    }
  }

  /** Enter in a field takes the primary path: publishing, with drafting the explicit detour. */
  function submit(event: FormEvent) {
    event.preventDefault();
    void create("publish");
  }

  async function publish(property: PropertyRecord) {
    const data = await request(`/api/admin/properties/${property.slug}/publish`, "POST");
    if (data.property) {
      setProperties((current) =>
        current.map((entry) =>
          entry.slug === property.slug ? (data.property as PropertyRecord) : entry,
        ),
      );
      toast.success(`"${property.name}" is live on ${placementLabel(data.property as PropertyRecord)}.`);
    }
  }

  async function unpublish(property: PropertyRecord) {
    const data = await request(`/api/admin/properties/${property.slug}/unpublish`, "POST");
    if (data.property) {
      setProperties((current) =>
        current.map((entry) =>
          entry.slug === property.slug ? (data.property as PropertyRecord) : entry,
        ),
      );
      toast.success(`"${property.name}" is unpublished. Unpublish is the everyday undo.`);
    }
  }

  async function move(slug: string, direction: -1 | 1) {
    const slugs = properties.map((entry) => entry.slug);
    const index = slugs.indexOf(slug);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slugs.length) return;

    const next = [...slugs];
    const current = next[index] as string;
    next[index] = next[target] as string;
    next[target] = current;

    const data = await request("/api/admin/properties/reorder", "POST", { slugs: next });
    if (data.properties) {
      setProperties(data.properties);
      toast.success("Order saved — the grid, the drawer pager and the shortlist follow it.");
    }
  }

  async function remove(property: PropertyRecord) {
    const data = await request(`/api/admin/properties/${property.slug}`, "DELETE");
    setProperties((current) => current.filter((entry) => entry.slug !== property.slug));
    setConfirmDelete("");
    toast.success(
      `"${property.name}" deleted${data.mediaRemoved ? ` (${data.mediaRemoved} media row(s))` : ""}. The audit row keeps the full JSON.`,
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New property</CardTitle>
          <CardDescription>
            The slug is derived from the name and is permanent. Publish now puts it on the site in
            seconds; a draft waits on this list until you publish it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="The Manor"
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-location">Location</Label>
              <Input
                id="new-location"
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Cantonments, Accra"
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as PropertyStatus }))
                }
              >
                <SelectTrigger id="new-status">
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
            <fieldset className="grid gap-2 sm:col-span-3">
              <legend className="text-sm font-medium">Publish to</legend>
              <div className="flex flex-wrap gap-4">
                <label htmlFor="new-show-home" className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="new-show-home"
                    checked={form.showOnHome}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, showOnHome: checked === true }))
                    }
                  />
                  Landing page
                </label>
                <label htmlFor="new-show-listing" className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="new-show-listing"
                    checked={form.showOnListing}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, showOnListing: checked === true }))
                    }
                  />
                  Properties page
                </label>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-start gap-3 sm:col-span-3">
              <Button type="submit" disabled={creating !== null}>
                {creating === "publish" ? "Publishing…" : "Publish now"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={creating !== null}
                onClick={() => void create("draft")}
              >
                {creating === "draft" ? "Saving…" : "Save as draft"}
              </Button>
              {formError ? (
                <p role="alert" className="mt-2 w-full text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Catalogue · {properties.length}</h2>

        {properties.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOff />
              </EmptyMedia>
              <EmptyTitle>No properties yet</EmptyTitle>
              <EmptyDescription>Create the first draft above to get started.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {properties.map((property, index) => {
              const status = badge(property);
              const busy = busySlug === property.slug;
              const thumbKey = thumbnails[property.slug];
              const thumb = thumbKey ? mediaSrcClient(thumbKey, publicBaseUrl) : "";
              return (
                <li key={property.slug}>
                  <Card className="gap-0 py-0">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                      <div className="h-32 w-full shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-20 sm:w-28">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
                            no image
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            <span className="font-mono text-xs text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate">{property.name}</span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {property.location} · {property.status}
                            {property.price ? ` · ${property.price}` : ""}
                            {property.publishedAt
                              ? ` · last published ${formatAccra(property.publishedAt)}${property.publishedBy ? ` by ${property.publishedBy}` : ""}`
                              : ""}
                          </p>
                          {/* Stated for every row, live or not: "where would this go?" is the
                              question the publish buttons answer, and a draft's answer is
                              already decided before it is published. */}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {property.published ? "Live on " : "Will publish to "}
                            {placementLabel(property)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Button type="button" variant="secondary" size="sm" asChild>
                            <Link href={`/admin/properties/${property.slug}`}>Edit</Link>
                          </Button>
                          {/* A link rather than a dialog: previewing from a list of twenty rows
                              would mean twenty live previews mounted at once. `?preview=1` opens
                              the editor with its preview already up (property-editor.tsx). */}
                          <Button type="button" variant="ghost" size="sm" asChild>
                            <Link href={`/admin/properties/${property.slug}?preview=1`}>
                              Preview
                            </Link>
                          </Button>
                          {property.published ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => act(property.slug, () => unpublish(property))}
                            >
                              Unpublish
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              disabled={busy}
                              onClick={() => act(property.slug, () => publish(property))}
                            >
                              Publish
                            </Button>
                          )}
                          {isAdmin ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy || index === 0}
                                onClick={() => act(property.slug, () => move(property.slug, -1))}
                                aria-label={`Move ${property.name} up`}
                                title="Move up"
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy || index === properties.length - 1}
                                onClick={() => act(property.slug, () => move(property.slug, 1))}
                                aria-label={`Move ${property.name} down`}
                                title="Move down"
                              >
                                <ArrowDown />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {property.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Type <span className="font-mono">{property.slug}</span> to
                                      confirm. The audit row keeps the full JSON.
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
                                      onClick={() => act(property.slug, () => remove(property))}
                                    >
                                      Delete property
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
