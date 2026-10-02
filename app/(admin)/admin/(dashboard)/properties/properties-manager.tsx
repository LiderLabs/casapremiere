"use client";

// The property list (docs/cms-build-spec.md §7): every property in grid order, drafts
// included, with the card thumbnail, the Live / Draft / Pending badge, the last-published
// line and the row actions. Every write goes through /api/admin/properties**, where the
// role checks live — the UI hides what the API would refuse, so an editor never sees a
// delete button and an admin gets the ordering buttons and the delete dialog.
//
// The thumbnail is the property's card (or hero) key from Phase 6's upload pipeline, so a
// newly uploaded image shows here without a second round trip per row.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  const [form, setForm] = useState({
    name: "",
    location: "",
    status: "Available" as PropertyStatus,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function act(slug: string, fn: () => Promise<void>) {
    setBusySlug(slug);
    setError(null);
    setNotice(null);
    try {
      await fn();
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That request failed.");
    } finally {
      setBusySlug(null);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setFormError(null);
    setNotice(null);
    try {
      const data = await request("/api/admin/properties", "POST", {
        name: form.name,
        location: form.location,
        status: form.status,
      });
      if (data.property) {
        setProperties((current) => [...current, data.property as PropertyRecord]);
        setNotice(`"${data.property.name}" created as a draft.`);
        setForm({ name: "", location: "", status: "Available" });
      }
      router.refresh();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : "Could not create the property.");
    } finally {
      setCreating(false);
    }
  }

  async function publish(property: PropertyRecord) {
    const data = await request(`/api/admin/properties/${property.slug}/publish`, "POST");
    if (data.property) {
      setProperties((current) =>
        current.map((entry) =>
          entry.slug === property.slug ? (data.property as PropertyRecord) : entry,
        ),
      );
      setNotice(`"${property.name}" is live on / and /interior.`);
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
      setNotice(`"${property.name}" is unpublished. Unpublish is the everyday undo.`);
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
      setNotice("Order saved — the grid, the drawer pager and the shortlist follow it.");
    }
  }

  async function remove(property: PropertyRecord) {
    const data = await request(`/api/admin/properties/${property.slug}`, "DELETE");
    setProperties((current) => current.filter((entry) => entry.slug !== property.slug));
    setConfirmDelete("");
    setNotice(
      `"${property.name}" deleted${data.mediaRemoved ? ` (${data.mediaRemoved} media row(s))` : ""}. The audit row keeps the full JSON.`,
    );
  }

  return (
    <div className="mt-8">
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

      <section className="mt-6 rounded-lg border border-border p-5">
        <h2 className="text-sm font-medium">New property</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Creates a draft. The slug is derived from the name and is permanent.
        </p>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
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
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
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
          <div className="sm:col-span-3">
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create draft"}
            </Button>
            {formError ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Catalogue · {properties.length}</h2>
        {properties.length === 0 ? (
          <p className="mt-3 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
            No properties yet. Create the first draft above.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {properties.map((property, index) => {
              const status = badge(property);
              const busy = busySlug === property.slug;
              const thumbKey = thumbnails[property.slug];
              const thumb = thumbKey ? mediaSrcClient(thumbKey, publicBaseUrl) : "";
              return (
                <li key={property.slug} className="flex flex-wrap gap-4 px-4 py-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded border border-border bg-muted">
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
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-medium">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {property.name}
                    </p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {property.location} · {property.status}
                    {property.price ? ` · ${property.price}` : ""}
                    {property.publishedAt
                      ? ` · last published ${formatAccra(property.publishedAt)}${property.publishedBy ? ` by ${property.publishedBy}` : ""}`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" asChild>
                      <Link href={`/admin/properties/${property.slug}`}>Edit</Link>
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
                          size="sm"
                          disabled={busy || index === 0}
                          onClick={() => act(property.slug, () => move(property.slug, -1))}
                          aria-label={`Move ${property.name} up`}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy || index === properties.length - 1}
                          onClick={() => act(property.slug, () => move(property.slug, 1))}
                          aria-label={`Move ${property.name} down`}
                        >
                          ↓
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm" disabled={busy}>
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}


