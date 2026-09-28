"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { track } from "@vercel/analytics";

import {
  CROSS_SELL_CLICK_EVENT,
  crossSiteAnalyticsProps,
  crossSiteHref,
  type CrossSiteLinkOptions,
  type CrossSiteTarget,
} from "@/lib/cross-sell";

type CrossSiteLinkProps = CrossSiteLinkOptions & {
  target: CrossSiteTarget;
  className?: string;
  /**
   * Extra click work for the host - the mobile menus use it to close
   * themselves. Only passable from a client component, which is where every
   * menu lives.
   */
  onNavigate?: () => void;
  children: ReactNode;
};

/**
 * The only way a link should cross between the two sites.
 *
 * It renders an ordinary `<Link>` - same element, same classes, same DOM as the
 * hand-written anchors it replaces - and additionally reports the click. A
 * client component so it can be dropped into either a server or a client
 * parent: `components/footer.tsx` and `components/interior-section.tsx` are
 * server components and stay that way, which is also why this wrapper exists
 * rather than a `useCrossSite()` hook at each call site.
 */
export function CrossSiteLink({
  target,
  surface,
  service,
  property,
  book,
  className,
  onNavigate,
  children,
}: CrossSiteLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();

    // Count only a plain left-click that really navigates in this tab.
    // cmd/ctrl/shift-click opens a background tab and middle-click a new one;
    // inflated numbers are worse than no numbers.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    track(
      CROSS_SELL_CLICK_EVENT,
      crossSiteAnalyticsProps(target, { surface, service, property, book }),
    );
  };

  return (
    <Link
      href={crossSiteHref(target, { surface, service, property, book })}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
