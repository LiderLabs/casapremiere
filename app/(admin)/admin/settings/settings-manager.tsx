"use client";

// The business settings form (docs/cms-build-spec.md §6, §7): the six known keys, edited as
// one form and saved with one PUT. An unset key is absent server-side, so the reader falls
// back to the hard-coded value — which is why clearing a field and saving removes the row
// rather than storing a blank.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SettingValue } from "@/lib/cms/queries";
import type { SettingKey } from "@/lib/cms/validation";

function toText(value: SettingValue | undefined): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function SettingsManager({
  initial,
  order,
  labels,
}: {
  initial: Partial<Record<SettingKey, SettingValue>>;
  order: SettingKey[];
  labels: Record<SettingKey, string>;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<SettingKey, string>>(() => {
    const next = {} as Record<SettingKey, string>;
    for (const key of order) next[key] = toText(initial[key]);
    return next;
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const body: Record<string, unknown> = {};
    for (const key of order) {
      const text = values[key].trim();
      if (!text) continue;
      if (key === "footerLinks") {
        try {
          body[key] = JSON.parse(text) as unknown;
        } catch {
          setError("Footer links must be valid JSON: [{ label, href }].");
          setSaving(false);
          return;
        }
      } else {
        body[key] = values[key];
      }
    }

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save the settings.");

      setNotice("Settings saved. Unset keys fall back to the hard-coded values.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-4">
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

      {order.map((key) =>
        key === "footerLinks" ? (
          <div key={key} className="grid gap-1.5 rounded-lg border border-border p-5">
            <Label htmlFor={`setting-${key}`}>{labels[key]}</Label>
            <Textarea
              id={`setting-${key}`}
              value={values[key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [key]: event.target.value }))
              }
              rows={5}
              className="font-mono text-xs"
              placeholder='[{ "label": "Estates", "href": "/" }]'
            />
          </div>
        ) : (
          <div key={key} className="grid gap-1.5 rounded-lg border border-border p-5">
            <Label htmlFor={`setting-${key}`}>{labels[key]}</Label>
            <Input
              id={`setting-${key}`}
              value={values[key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [key]: event.target.value }))
              }
              placeholder="Unset — falls back to the hard-coded value"
            />
          </div>
        ),
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
