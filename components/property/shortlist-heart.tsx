"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";

import {
  MAX_SHORTLIST,
  toggleShortlist,
  useShortlistSlugs,
} from "@/components/property/shortlist-store";
import { cn } from "@/lib/utils";

type ShortlistHeartProps = {
  slug: string;
  /** Used in the accessible name and the toast copy. */
  name: string;
  className?: string;
  /** `icon` is the circular control on a card, `labelled` the text button in the drawer. */
  variant?: "icon" | "labelled";
  /**
   * Card hearts sit over photography, so they carry their own backdrop. The
   * black/white pairing is deliberate here for the same reason the hero uses it:
   * it has to read against an image, not against a theme.
   */
  overlay?: boolean;
};

export function ShortlistHeart({
  slug,
  name,
  className,
  variant = "icon",
  overlay = false,
}: ShortlistHeartProps) {
  const slugs = useShortlistSlugs();
  const isSaved = slugs.includes(slug);

  const handleClick = () => {
    const result = toggleShortlist(slug);

    if (result === "added") {
      toast.success(`${name} saved to your shortlist`);
    } else if (result === "removed") {
      toast(`${name} removed from your shortlist`);
    } else {
      toast.error(
        `Your shortlist holds ${MAX_SHORTLIST} homes - remove one to add another.`,
      );
    }
  };

  const label = isSaved
    ? `Remove ${name} from your shortlist`
    : `Save ${name} to your shortlist`;

  if (variant === "labelled") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isSaved}
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
          className,
        )}
      >
        <Heart className={cn("size-4", isSaved && "fill-current")} aria-hidden="true" />
        {isSaved ? "Saved to shortlist" : "Save to shortlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isSaved}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        overlay
          ? "border border-white/30 bg-black/45 text-white backdrop-blur-sm hover:bg-black/65"
          : "border border-border text-foreground hover:bg-secondary",
        className,
      )}
    >
      <Heart className={cn("size-4", isSaved && "fill-current")} aria-hidden="true" />
    </button>
  );
}
