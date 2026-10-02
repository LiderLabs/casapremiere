"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Revokes the session in the database and then clears the cookie (see
 * app/api/admin/auth/logout). A full replace, not a push, so the signed-out dashboard cannot
 * be reached with the back button.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/admin/auth/logout", { method: "POST" });
        } finally {
          router.replace("/admin/signin");
          router.refresh();
        }
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
