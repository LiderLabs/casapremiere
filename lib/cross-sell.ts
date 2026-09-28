// Cross-site links between the two sites that share this one app:
//   "/"          = CASA Premier (estate)
//   "/interior"  = CASA Premier Interiors
//


import type { BookingService } from "@/lib/booking";
import { MAIN_SITE_URL, SISTER_SITE_URL } from "@/lib/site-links";

export type CrossSiteTarget = "estate" | "interior";

/**
 * Where a cross-site link lives.
 *
 * A closed vocabulary rather than free text, because the point of `src` is to
 * rank the surfaces against each other - `estate-drawer` and `estate-footer`
 * only compare if they are spelled the same way every time. Adding a link means
 * adding its surface here first.
 */
export type CrossSellSurface =
  // estate -> interior
  | "estate-header"
  | "estate-header-menu"
  | "estate-footer-explore"
  | "estate-footer-services"
  | "estate-band"
  | "estate-drawer"
  | "estate-shortlist"
  | "estate-mortgage"
  // interior -> estate
  | "interior-header"
  | "interior-header-menu"
  | "interior-footer"
  | "interior-band"
  | "interior-homes"
  | "interior-home-card"
  | "interior-faq";

/**
 * Usage sites append "/" themselves, so the root base is intentionally ""
 * (`MAIN_SITE_URL`). See lib/site-links.ts.
 */
const BASE_PATH: Record<CrossSiteTarget, string> = {
  estate: MAIN_SITE_URL,
  interior: SISTER_SITE_URL,
};

export type CrossSiteLinkOptions = {
  /** Which surface the link sits on - becomes `?src=`. */
  surface: CrossSellSurface;
  /** Presets the appointment modal's service field on arrival (`?service=`). */
  service?: BookingService;
  /** Opens one home on arrival (`?property=<slug>`). Estate side only. */
  property?: string;
  /** Opens the appointment modal on arrival (`?book=1`). */
  book?: boolean;
};

/**
 * In-app href for a link that leaves one site and lands on the other.
 *
 * `?service=`, `?property=` and `?book=1` are read on the far side by
 * BookingProvider and PropertyProvider, so a cross-sell link lands with the
 * visitor's context intact instead of dropping them on a hero to start again.
 */
export function crossSiteHref(
  target: CrossSiteTarget,
  { surface, service, property, book }: CrossSiteLinkOptions,
): string {
  const params = new URLSearchParams({ src: surface });

  if (book) params.set("book", "1");
  if (service) params.set("service", service);
  if (property) params.set("property", property);

  return `${BASE_PATH[target]}/?${params.toString()}`;
}

/** Fired when a visitor clicks a link from one site to the other. */
export const CROSS_SELL_CLICK_EVENT = "cross_site_click";

/**
 * Fired when one site's surface hands the visitor to the appointment modal
 * already preset to the *other* site's service (the drawer, the shortlist and
 * the affordability dialog all offer interior design). Those hand-offs never
 * navigate, so they would otherwise be invisible in the `src` report.
 */
export const CROSS_SELL_BOOKING_EVENT = "cross_sell_booking";

/**
 * Event properties for a cross-site click.
 *
 * Plain data, deliberately: this file stays importable from anywhere, and the
 * `track()` call itself lives in `components/cross-site-link.tsx` because
 * `track` is browser-only.
 */
export function crossSiteAnalyticsProps(
  target: CrossSiteTarget,
  { surface, service, property }: CrossSiteLinkOptions,
): Record<string, string> {
  const props: Record<string, string> = { surface, target };

  if (service) props.service = service;
  if (property) props.property = property;

  return props;
}

/**
 * Event properties for the in-place hand-offs - the property drawer, the
 * shortlist and the affordability dialog all open the appointment modal preset
 * to the *other* site's service ("Interior design").
 *
 * Those never navigate, so they have no `src` to report and would be invisible
 * in the click report; this event is what shows whether a visitor who was
 * looking at a home actually asked us to fit it out.
 */
export function crossSellBookingAnalyticsProps(
  surface: CrossSellSurface,
  service: BookingService,
): Record<string, string> {
  return { surface, service };
}
