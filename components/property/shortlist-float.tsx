"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

import { useShortlistPanel } from "@/components/property/shortlist-provider";
import { useShortlistSlugs } from "@/components/property/shortlist-store";
import { cn } from "@/lib/utils";

/**
 * Floating entry point into the shortlist - saved homes only.
 *
 * It shows itself once the visitor has saved at least one home *and* has
 * scrolled past the hero: the hero pins its own tagline and CTAs to the bottom
 * of the viewport, and on phones those buttons are full width, so a floating
 * pill would sit on top of the primary action. Adding a home happens on the
 * card hearts and in the property drawer; this is where the list is opened.
 *
 * The button stays mounted and hides itself with classes rather than returning
 * null, so the reveal can animate and the hidden state is never tabbable or
 * clickable.
 */
const REVEAL_AFTER_VIEWPORTS = 0.6;

export function ShortlistFloat() {
  const slugs = useShortlistSlugs();
  const { openPanel } = useShortlistPanel();
  const [isPastHero, setIsPastHero] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const update = () => {
      frame = null;
      setIsPastHero(window.scrollY > window.innerHeight * REVEAL_AFTER_VIEWPORTS);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  const count = slugs.length;
  const isVisible = count > 0 && isPastHero;

  return (
    <button
      type="button"
      onClick={openPanel}
      aria-haspopup="dialog"
      aria-label={
        count > 0 ? `Open your shortlist, ${count} saved` : "Open your shortlist"
      }
      aria-hidden={!isVisible}
      tabIndex={isVisible ? undefined : -1}
      className={cn(
        // Outlined rather than filled: the outline keeps its silhouette over the
        // bg-black gallery and technology bands, where a solid dark pill would
        // merge into the background.
        "fixed right-5 bottom-[calc(1.25rem_+_env(safe-area-inset-bottom))] z-40 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-3 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-all duration-300 ease-out hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none dark:border-white/20 dark:bg-secondary/90",
        isVisible
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0 motion-reduce:scale-100",
      )}
    >
      <Heart className="size-5 shrink-0 fill-current" aria-hidden="true" />
      <span className="hidden sm:inline">Shortlist</span>
      {/* The count is in the button's accessible name already. */}
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[0.7rem] leading-none font-medium text-background"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
