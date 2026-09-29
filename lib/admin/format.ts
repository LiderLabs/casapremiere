// Timestamps in the admin are always shown in the site's own time zone, matching
// BOOKING_TIME_ZONE_LABEL in lib/booking.ts - so "who published this at 14:05" means the same
// thing to everyone, whatever the browser's clock says.

const accraFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Accra",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** e.g. `29 Sep, 14:05 GMT (Accra)` */
export function formatAccra(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return `${accraFormatter.format(date)} GMT (Accra)`;
}
