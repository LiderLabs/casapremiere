"use client";

// The signed-in user's menu, pinned to the sidebar footer. It owns the one destructive
// action in the shell (sign out) and reuses the same endpoint the old dashboard button did:
// the session row is revoked server-side, then the cookie is cleared.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronsUpDown, KeyRound, LogOut, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type AdminIdentity = {
  name: string;
  username: string;
  role: "admin" | "editor";
};

/** Two letters for the avatar: initials when there is a name, else the username. */
function initials(user: AdminIdentity): string {
  const source = (user.name || user.username).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string)[0]}${(parts[parts.length - 1] as string)[0]}`.toUpperCase();
}

export function NavUser({ user }: { user: AdminIdentity }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/signin");
      router.refresh();
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(user)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name || user.username}</span>
                <span className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                  {user.role}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={8}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(user)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name || user.username}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.username}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Signed in as {user.role}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => router.push("/admin/password")}>
                <KeyRound />
                Change password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() => {
                void signOut();
              }}
            >
              <LogOut />
              {pending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
