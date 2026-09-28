"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Light/dark switch for the estate site.
 *
 * The provider runs with `enableSystem={false}` and `defaultTheme="light"`, so
 * the only route into dark mode is this button - and the server-rendered markup
 * already matches the pre-hydration state. The icons are still gated behind a
 * mounted flag, because `resolvedTheme` is only trustworthy once the provider
 * has read the stored preference on the client.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const isDark = isMounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        className,
      )}
    >
      {/* Both icons are always laid out, so the header never shifts on mount. */}
      <span className="relative block size-4" aria-hidden="true">
        <Sun
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 motion-reduce:transition-none",
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 size-4 transition-all duration-300 motion-reduce:transition-none",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
          )}
        />
      </span>
    </button>
  );
}
