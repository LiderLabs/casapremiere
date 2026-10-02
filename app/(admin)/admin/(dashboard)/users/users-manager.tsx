"use client";

// The users screen (docs/cms-build-spec.md §7). Deliberately plain: a create card, one card
// per account, and the four things an admin actually does — change a role, disable an
// account, reset a password, end someone's sessions.
//
// Every write goes through /api/admin/users**, so the guards (last admin, self, revocation)
// and the audit rows live in one place rather than in the browser. Transient outcomes are
// sonner toasts; the one thing that must persist is a temporary password, shown once in a
// copyable panel — a toast would dismiss before it could be passed on.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
import { PASSWORD_MIN_LENGTH } from "@/lib/admin/password-policy";
import type { AdminUser } from "@/lib/admin/users";

type UserRole = AdminUser["role"];
type UserStatus = AdminUser["status"];
type PasswordNotice = { title: string; body: string };

type ApiPayload = {
  error?: string;
  user?: AdminUser;
  temporaryPassword?: string;
  sessionsRevoked?: number;
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
    throw new Error(data.error ?? "That request failed. Please try again.");
  }

  return data;
}

export function UsersManager({
  users: initialUsers,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();

  const [users, setUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<PasswordNotice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    role: "editor" as UserRole,
    tempPassword: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const updateForm = (patch: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...patch }));

  /** The response is authoritative: it is the row the database just wrote. */
  const replace = (user: AdminUser) =>
    setUsers((current) => current.map((entry) => (entry.id === user.id ? user : entry)));

  async function run(user: AdminUser, action: () => Promise<void>) {
    setBusyId(user.id);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Temporary password copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context; the password is on screen either way.
      setCopied(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreating(true);

    try {
      const data = await request("/api/admin/users", "POST", {
        username: form.username,
        name: form.name,
        email: form.email,
        role: form.role,
        // Left empty, the server generates one — so a password never has to be invented here.
        ...(form.tempPassword ? { tempPassword: form.tempPassword } : {}),
      });

      if (data.user) setUsers((current) => [...current, data.user as AdminUser]);

      setNotice({
        title: `Temporary password for ${data.user?.username ?? form.username}`,
        body: data.temporaryPassword ?? "",
      });
      toast.success(`User "${data.user?.username ?? form.username}" created.`);
      setForm({ username: "", name: "", email: "", role: "editor", tempPassword: "" });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the user.";
      setFormError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(user: AdminUser, role: UserRole) {
    await run(user, async () => {
      const data = await request(`/api/admin/users/${user.id}`, "PATCH", { role });
      if (data.user) replace(data.user);
      toast.success(`${user.username} is now ${role === "admin" ? "an admin" : "an editor"}.`);
    });
  }

  async function changeStatus(user: AdminUser, status: UserStatus) {
    await run(user, async () => {
      // DELETE is the documented disable action; enabling is a PATCH back to active.
      const data =
        status === "disabled"
          ? await request(`/api/admin/users/${user.id}`, "DELETE")
          : await request(`/api/admin/users/${user.id}`, "PATCH", { status });
      if (data.user) replace(data.user);
      toast.success(
        status === "disabled" ? `${user.username} was disabled.` : `${user.username} was enabled.`,
      );
    });
  }

  async function resetPassword(user: AdminUser) {
    await run(user, async () => {
      const data = await request(`/api/admin/users/${user.id}/reset-password`, "POST");
      if (data.user) replace(data.user);
      setNotice({
        title: `Temporary password for ${user.username}`,
        body: data.temporaryPassword ?? "",
      });
      toast.success(`${user.username}'s password was reset. Copy the new one below.`);
    });
  }

  async function signOutEverywhere(user: AdminUser) {
    await run(user, async () => {
      const data = await request(`/api/admin/users/${user.id}/sign-out`, "POST");
      replace({ ...user, activeSessions: 0 });
      toast.success(
        `${user.username} was signed out — ${data.sessionsRevoked ?? 0} session(s) ended.`,
      );
    });
  }

  return (
    <div className="space-y-8">
      {notice ? (
        <Card role="status" aria-live="polite" className="border-foreground/20 bg-accent/40">
          <CardContent className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{notice.title}</p>
              <p className="mt-2 select-all font-mono text-base tracking-wide">{notice.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Shown once — copy it now. It is not stored anywhere we can read back, and the user
                must choose their own password at first sign-in.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyPassword(notice.body)}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNotice(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a user</CardTitle>
          <CardDescription>
            Accounts are created here, never seeded: the new user picks their own password at first
            sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  name="username"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={form.username}
                  onChange={(event) => updateForm({ username: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">3–32 characters: a–z 0–9 . _ -</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-name">Display name</Label>
                <Input
                  id="new-name"
                  name="name"
                  autoComplete="off"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email">Email (optional)</Label>
                <Input
                  id="new-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => updateForm({ role: value as UserRole })}
                >
                  <SelectTrigger id="new-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor — content and publishing</SelectItem>
                    <SelectItem value="admin">Admin — everything, including users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Temporary password (optional)</Label>
              <Input
                id="new-password"
                name="tempPassword"
                autoComplete="off"
                minLength={PASSWORD_MIN_LENGTH}
                aria-describedby="new-password-hint"
                value={form.tempPassword}
                onChange={(event) => updateForm({ tempPassword: event.target.value })}
              />
              <p id="new-password-hint" className="text-xs text-muted-foreground">
                Leave this blank and the server generates one — at least {PASSWORD_MIN_LENGTH}{" "}
                characters. Either way it is shown once, after the account is created.
              </p>
            </div>

            <p aria-live="polite" className="min-h-5 text-sm text-destructive">
              {formError ?? ""}
            </p>

            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {users.length === 1 ? "1 account" : `${users.length} accounts`}
        </h2>

        <ul className="space-y-3">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const busy = busyId === user.id;

            return (
              <li key={user.id}>
                <Card className="gap-0 py-0">
                  <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{user.name || user.username}</span>
                        {isSelf ? <Badge variant="outline">You</Badge> : null}
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                        {user.status === "disabled" ? (
                          <Badge variant="destructive">Disabled</Badge>
                        ) : null}
                        {user.mustChangePassword ? (
                          <Badge variant="outline">Password change due</Badge>
                        ) : null}
                        {user.lockedUntil ? <Badge variant="outline">Locked</Badge> : null}
                      </p>

                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {user.username}
                        {user.email ? ` · ${user.email}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {user.lastLoginAt
                          ? `Last signed in ${formatAccra(user.lastLoginAt)}`
                          : "Has not signed in yet"}
                        {" · "}
                        {user.activeSessions === 1
                          ? "1 active session"
                          : `${user.activeSessions} active sessions`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Select
                        value={user.role}
                        disabled={isSelf || busy}
                        onValueChange={(value) => changeRole(user, value as UserRole)}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label={`Role for ${user.username}`}
                          className="w-[8.5rem]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="outline" size="sm" disabled={busy}>
                            Reset password
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Reset the password for {user.username}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              A new temporary password is shown once — copy it and pass it on.
                              Every session they have open ends immediately, and they must choose
                              their own password at the next sign-in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => resetPassword(user)}>
                              Reset password
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || user.activeSessions === 0}
                        onClick={() => signOutEverywhere(user)}
                      >
                        Sign out everywhere
                      </Button>

                      {user.status === "disabled" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => changeStatus(user, "active")}
                        >
                          Enable
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy || isSelf}
                              title={isSelf ? "You cannot disable your own account" : undefined}
                            >
                              Disable
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disable {user.username}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                They are signed out immediately and cannot sign in again until an
                                admin enables the account. Nothing they created is deleted, and the
                                audit trail keeps their name on it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => changeStatus(user, "disabled")}>
                                Disable account
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <p className="mt-1 text-xs text-muted-foreground">
          The last active admin cannot be disabled or demoted, and nobody can disable or demote
          themselves — so the admin can never lock itself out.
        </p>
      </section>
    </div>
  );
}