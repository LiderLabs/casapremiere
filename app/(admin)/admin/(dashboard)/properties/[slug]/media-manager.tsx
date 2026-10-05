"use client";

// The media manager (docs/cms.md Section 8, Section 9): upload, alt text and delete, grouped by the
// three roles a listing actually has instead of by a role dropdown.
//
// The grouping is the point. "Which image is the card?" was one dropdown away from being answered
// wrong; here the card section holds at most one image by construction, and uploading into it
// demotes whatever was there to the gallery — the rule the server already enforces (queries.
// confirmMedia) and the one publish trusts.
//
// The browser resizes to WebP (≤2000px, q0.8, ≤1.5MB) before the PUT, so bytes go straight to R2
// and Vercel only ever signs. Alt text is edited in place and saved per image: it is the public
// site's accessibility, not a detail to be batched.
//
// Outcomes are sonner toasts. Each row stacks on mobile and lays out side-by-side from sm, so the
// preview, the alt field and the delete button are all reachable at 390px.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaSrcClient } from "@/lib/cms/public-client";
import type { MediaRecord } from "@/lib/cms/queries";

type Role = MediaRecord["role"];

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

const MAX_BYTES = 1_500_000;
const MAX_EDGE = 2000;

/** Resize to WebP in the browser: longest edge ≤2000px, quality 0.8, ≤1.5MB. */
async function resizeToWebP(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize images.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
  if (!blob) throw new Error("This browser cannot resize images.");
  if (blob.size > MAX_BYTES) {
    throw new Error("That image is still over 1.5 MB after resizing. Try a smaller file.");
  }

  return { blob, width, height };
}

export function MediaManager({
  slug,
  media: initial,
  publicBaseUrl,
}: {
  slug: string;
  media: MediaRecord[];
  publicBaseUrl?: string;
}) {
  const router = useRouter();

  const [media, setMedia] = useState(initial);
  const [busy, setBusy] = useState(false);
  /** Which section is mid-upload, so only that section's control goes quiet. */
  const [uploading, setUploading] = useState<Role | null>(null);
  /** Unsaved alt text, by image id. One field, because alt is the only thing editable per image. */
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function call(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      media?: MediaRecord;
      url?: string;
      key?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "That request failed.");
    return data;
  }

  /**
   * Resize, sign, PUT, confirm — for one section's images at a time. The role travels with the
   * uploads rather than sitting in a dropdown beside them, so an image cannot be filed under a
   * section nobody was looking at when they chose the file.
   */
  async function upload(files: FileList | null, role: Role) {
    if (!files || files.length === 0) return;
    setUploading(role);
    try {
      const uploaded: MediaRecord[] = [];
      for (const file of Array.from(files)) {
        const resized = await resizeToWebP(file);
        const signed = await call("/api/admin/uploads/sign", "POST", {
          slug,
          contentType: "image/webp",
          bytes: resized.blob.size,
        });
        if (!signed.url || !signed.key) throw new Error("The upload could not be signed.");
        const put = await fetch(signed.url, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: resized.blob,
        });
        if (!put.ok) throw new Error("The upload to storage failed. Please try again.");
        const confirmed = await call("/api/admin/uploads/confirm", "POST", {
          key: signed.key,
          role,
          alt: "",
          width: resized.width,
          height: resized.height,
          bytes: resized.blob.size,
        });
        if (confirmed.media) uploaded.push(confirmed.media);
      }
      setMedia((current) => [...current, ...uploaded]);
      if (role === "card") {
        // Said out loud, because it is the one upload that changes another image's role: the server
        // demotes the old card to the gallery, and the list below will show it move.
        toast.success("Card image set. The previous card image, if there was one, is now gallery.");
      } else {
        toast.success(`${uploaded.length} ${role} image(s) uploaded. Add alt text before publishing.`);
      }
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "The upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function saveAlt(id: string) {
    const alt = edits[id];
    if (alt === undefined) return;
    setBusy(true);
    try {
      const data = await call(`/api/admin/media/${id}`, "PATCH", { alt });
      if (data.media) {
        setMedia((current) =>
          current.map((item) => (item.id === id ? (data.media as MediaRecord) : item)),
        );
      }
      setEdits((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast.success("Alt text saved.");
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not update the image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await call(`/api/admin/media/${id}`, "DELETE");
      setMedia((current) => current.filter((item) => item.id !== id));
      toast.success("Image deleted.");
      router.refresh();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not delete the image.");
    } finally {
      setBusy(false);
    }
  }

  const card = media.find((item) => item.role === "card");
  const heroes = media.filter((item) => item.role === "hero");
  const gallery = media.filter((item) => item.role === "gallery");

  /**
   * Hero and gallery are the same list with different copy, so they render through one builder
   * rather than two near-identical blocks. Each section owns its own file input: the role belongs
   * to the place the image is going, not to a setting to remember before choosing a file.
   */
  function imageSection(
    role: "hero" | "gallery",
    title: string,
    description: string,
    items: MediaRecord[],
  ) {
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-prose">
            <h3 className="text-sm font-medium">
              {title} · {items.length}
            </h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Input
            type="file"
            multiple
            accept={ACCEPT}
            aria-label={`Add ${role} images`}
            disabled={uploading !== null}
            onChange={(event) => void upload(event.target.files, role)}
            className="w-full sm:w-64"
          />
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => {
              const alt = edits[item.id] ?? item.alt;
              const dirty = alt !== item.alt;
              const src = mediaSrcClient(item.r2Key, publicBaseUrl);
              return (
                <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={item.alt || `${slug} ${role} image`}
                    className="h-32 w-full rounded object-cover sm:h-16 sm:w-24"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {item.r2Key}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={alt}
                        onChange={(event) =>
                          setEdits((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        placeholder="Alt text — what this image shows"
                        aria-label={`Alt text for ${item.r2Key}`}
                        maxLength={240}
                        className="flex-1"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!dirty || busy}
                          onClick={() => void saveAlt(item.id)}
                        >
                          Save alt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void remove(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">

      <p className="text-xs text-muted-foreground">
        Resized in the browser to WebP, longest edge 2000px, quality 0.8, max 1.5 MB.
        {card ? "" : " Publishing needs a card image — upload one below."}
      </p>

      {publicBaseUrl ? null : (
        <p role="status" className="rounded-lg border border-border px-4 py-2 text-xs">
          No public image domain is configured, so previews are served through the app
          (<code>/api/media/…</code>). Set <code>R2_PUBLIC_BASE_URL</code> to serve them straight
          from R2 instead.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-prose">
            <h3 className="text-sm font-medium">Card image</h3>
            <p className="text-xs text-muted-foreground">
              The image the grids draw, and the one publish requires. There is at most one:
              uploading another demotes this one to the gallery — the rule the server enforces.
            </p>
          </div>
          <Input
            type="file"
            accept={ACCEPT}
            aria-label="Set the card image"
            disabled={uploading !== null}
            onChange={(event) => void upload(event.target.files, "card")}
            className="w-full sm:w-64"
          />
        </div>

        {card ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaSrcClient(card.r2Key, publicBaseUrl)}
              alt={card.alt || `${slug} card image`}
              className="h-32 w-full rounded object-cover sm:h-20 sm:w-28"
              loading="lazy"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate font-mono text-xs text-muted-foreground">{card.r2Key}</p>
              <Input
                value={edits[card.id] ?? card.alt}
                onChange={(event) =>
                  setEdits((current) => ({ ...current, [card.id]: event.target.value }))
                }
                placeholder="Alt text — what this image shows"
                aria-label="Alt text for the card image"
                maxLength={240}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={(edits[card.id] ?? card.alt) === card.alt || busy}
                  onClick={() => void saveAlt(card.id)}
                >
                  Save alt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void remove(card.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
            <ImagePlus className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No card image yet</p>
            <p className="text-xs text-muted-foreground">
              Publishing is blocked until one image is the card image. Choose a file above.
            </p>
          </div>
        )}
      </section>

      {imageSection(
        "hero",
        "Hero images",
        "The drawer's opening shots, in order — the first one leads. A listing with no hero uses its card image instead.",
        heroes,
      )}

      {imageSection(
        "gallery",
        "Gallery",
        "The rest of the photography, shown after the hero.",
        gallery,
      )}
    </div>
  );
}
