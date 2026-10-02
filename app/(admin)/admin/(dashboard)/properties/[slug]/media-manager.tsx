"use client";

// The media manager (docs/cms-build-spec.md §8): upload, role, alt text and delete. The
// browser resizes to WebP (≤2000px, q0.8, ≤1.5MB) before the PUT, so bytes go straight to
// R2 and Vercel only ever signs. Card is single: assigning a second card demotes the first
// to gallery — which is exactly what publish trusts. Replacing an image means uploading the
// new one first, so the card never goes missing in between.

import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { mediaSrcClient } from "@/lib/cms/public-client";
import type { MediaRecord } from "@/lib/cms/queries";

type Role = "card" | "hero" | "gallery";

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>("gallery");
  const [edits, setEdits] = useState<Record<string, { role: Role; alt: string }>>({});

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

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
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
      setNotice(`${uploaded.length} image(s) uploaded. Add alt text before publishing.`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const patch = edits[id];
    if (!patch) return;
    setBusy(true);
    setError(null);
    try {
      const data = await call(`/api/admin/media/${id}`, "PATCH", patch);
      if (data.media) {
        setMedia((current) => current.map((item) => (item.id === id ? (data.media as MediaRecord) : item)));
      }
      setEdits((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await call(`/api/admin/media/${id}`, "DELETE");
      setMedia((current) => current.filter((item) => item.id !== id));
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete the image.");
    } finally {
      setBusy(false);
    }
  }

  const card = media.find((item) => item.role === "card");

  return (
    <div>
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

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="media-role">Role for new uploads</Label>
          <Select value={role} onValueChange={(value) => setRole(value as Role)}>
            <SelectTrigger id="media-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="card">card (the grid image — one per home)</SelectItem>
              <SelectItem value="hero">hero (the drawer opening shot)</SelectItem>
              <SelectItem value="gallery">gallery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="media-files">Images</Label>
          <Input
            id="media-files"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            disabled={busy}
            onChange={(event) => upload(event.target.files)}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Resized in the browser to WebP, longest edge 2000px, quality 0.8, max 1.5 MB.
        {card ? "" : " Publishing needs a card image — mark one below."}
      </p>
      {publicBaseUrl ? null : (
        <p role="status" className="mt-2 rounded-lg border border-border px-4 py-2 text-xs">
          No public image domain is configured, so previews are served through the app
          (<code>/api/media/…</code>). Set <code>R2_PUBLIC_BASE_URL</code> to serve them
          straight from R2 instead.
        </p>
      )}

      {media.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
          No images yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {media.map((item) => {
            const edit = edits[item.id] ?? { role: item.role, alt: item.alt };
            const dirty = edit.role !== item.role || edit.alt !== item.alt;
            const src = mediaSrcClient(item.r2Key, publicBaseUrl);
            return (
              <li key={item.id} className="flex flex-wrap gap-4 px-4 py-3">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={item.alt || `${slug} image`}
                    className="h-16 w-24 rounded object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-52 flex-1 space-y-2">
                  <p className="font-mono text-xs uppercase text-muted-foreground">
                    {item.role} · {item.r2Key}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={edit.role}
                      onValueChange={(value) =>
                        setEdits((current) => ({
                          ...current,
                          [item.id]: { ...edit, role: value as Role },
                        }))
                      }
                    >
                      <SelectTrigger aria-label={`Role for ${item.r2Key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">card</SelectItem>
                        <SelectItem value="hero">hero</SelectItem>
                        <SelectItem value="gallery">gallery</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={edit.alt}
                      onChange={(event) =>
                        setEdits((current) => ({
                          ...current,
                          [item.id]: { ...edit, alt: event.target.value },
                        }))
                      }
                      placeholder="Alt text (required for hero and gallery)"
                      maxLength={240}
                      className="min-w-52 flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={!dirty || busy} onClick={() => saveEdit(item.id)}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(item.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

