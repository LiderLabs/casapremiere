"use client";

// The business settings form (docs/cms-build-spec.md §6, §7): the six known keys, edited as
// one form and saved with one PUT. An unset key is absent server-side, so the reader falls
// back to the hard-coded value — which is why clearing a field and saving removes the row
// rather than storing a blank.
//
// The fields live in one Card with the Save button in its footer; success is a toast, and the
// only inline message is the JSON error for `footerLinks`, which belongs to that textarea.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {};
    for (const key of order) {
      const text = values[key].trim();
      if (!text) continue;
      if (key === "footerLinks") {
        try {
          body[key] = JSON.parse(text) as unknown;
        } catch {
          const message = "Footer links must be valid JSON: [{ label, href }].";
          setError(message);
          toast.error(message);
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

      toast.success("Settings saved. Unset keys fall back to the hard-coded values.");
      router.refresh();
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "Could not save the settings.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business details</CardTitle>
          <CardDescription>
            An unset key falls back to the value still hard-coded in the sites. Clearing a field
            and saving removes the stored row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {order.map((key) =>
            key === "footerLinks" ? (
              <div key={key} className="grid gap-1.5">
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
              <div key={key} className="grid gap-1.5">
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

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end border-t pt-6">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
