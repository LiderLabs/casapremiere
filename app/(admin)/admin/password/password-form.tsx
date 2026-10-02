"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/admin/password-policy";

export function PasswordForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmation) {
      const message = "The two new passwords do not match.";
      setError(message);
      toast.error(message);
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/admin/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        const message = data.error ?? "Could not change the password. Please try again.";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("Password changed.");
      router.replace("/admin");
      router.refresh();
    } catch {
      const message = "Could not reach the server. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">
          {mustChangePassword ? "Temporary password" : "Current password"}
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          aria-describedby="newPasswordHint"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <p id="newPasswordHint" className="text-xs text-muted-foreground">
          At least {PASSWORD_MIN_LENGTH} characters. Longer beats complicated — a short phrase
          you will remember is fine.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Repeat the new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      <p aria-live="polite" className="min-h-5 text-sm text-destructive">
        {error ?? ""}
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : mustChangePassword ? "Save and continue" : "Change password"}
      </Button>
    </form>
  );
}
