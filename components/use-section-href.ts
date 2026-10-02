"use client";

import { usePathname } from "next/navigation";

/**
 * Resolves the estate site's section anchors (`#properties`, `#gallery`, …)
 * against whichever route is rendering them.
 *
 * `/` is a single scrolling page, and the header and footer are shared with
 * `/properties`. Off the landing page a bare `#gallery` points at nothing — the
 * browser finds no such element and the click silently does nothing, which is
 * exactly the bug a second route introduces. Hash links are therefore sent to
 * the landing page instead, where the sections actually are.
 *
 * Route links (`/properties`) and the placeholder `#` come back untouched, so
 * this is safe to wrap around every href rather than only around the anchors.
 */
export function useSectionHref() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (href: string) => {
    if (onHome || !href.startsWith("#") || href === "#") return href;
    return `/${href}`;
  };
}
