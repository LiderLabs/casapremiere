// Appointment-booking rules and helpers.
//
// Single source of truth for the booking modal: the calendar, the form
// validation and any future delivery handler all read from here so they can
// never disagree about which days, slots and services are allowed.
//
// Ghana runs on GMT/UTC+0 all year round (no daylight saving), so slots are
// unambiguous - the formatters below still pin the time zone explicitly.

export const BOOKING_TIME_ZONE = "Africa/Accra";
export const BOOKING_TIME_ZONE_LABEL = "GMT (Accra)";

/**
 * Flip to `true` once appointment requests are actually delivered somewhere
 * (e.g. `POST /api/booking` + email).
 *
 * While this is `false` the modal renders a disabled confirm button and points
 * visitors at phone/WhatsApp, so the site never claims to have received a
 * request it cannot deliver.
 */
export const BOOKING_SUBMISSION_ENABLED: boolean = false;

/** Bookable time slots. 12:00 is deliberately left out. */
export const BOOKING_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
] as const;

export type BookingSlot = (typeof BOOKING_SLOTS)[number];

/** 0 = Sunday ... 6 = Saturday. */
export const BOOKING_WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** Earliest bookable day, counted from today (1 = tomorrow). */
export const BOOKING_MIN_LEAD_DAYS = 1;

/** How far ahead the calendar lets a visitor book. */
export const BOOKING_HORIZON_DAYS = 90;

/** Extra closed days as `yyyy-mm-dd`, e.g. ["2026-12-25"]. */
export const BOOKING_BLACKOUT_DATES: readonly string[] = [];

export const BOOKING_SERVICES = [
  "Visit our site",
  "Renovation / remodel",
  "Interior design",
  "New home model",
  "General consultation",
  "Other",
] as const;

export type BookingService = (typeof BOOKING_SERVICES)[number];

// Business details used by the booking section/modal fallbacks.
// These mirror the details already shown in the contact section.
export const BOOKING_PHONE_DISPLAY = "+233 555 287 488";
export const BOOKING_PHONE_HREF = "tel:+233555287488";
export const BOOKING_WHATSAPP_NUMBER = "233555287488";
export const BOOKING_EMAIL = "projects@casapremiergh.com";
export const BOOKING_HOURS_LABEL = "Mon-Fri - 09:00-17:00 GMT";

const WEEKDAY_SET: ReadonlySet<number> = new Set<number>(BOOKING_WEEKDAYS);

const accraDayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BOOKING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const accraLongDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BOOKING_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** Midnight of the given day in the visitor's own time zone. */
export function startOfBookingDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addBookingDays(date: Date, days: number): Date {
  const next = startOfBookingDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** `yyyy-mm-dd` for the given day as observed in Accra (used for blackouts). */
export function bookingDateKey(date: Date): string {
  const parts = accraDayFormatter.formatToParts(date);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

export function isBookingWeekday(date: Date): boolean {
  return WEEKDAY_SET.has(date.getDay());
}

/**
 * True when the day can be booked: a configured weekday, no earlier than
 * `BOOKING_MIN_LEAD_DAYS`, no further out than `BOOKING_HORIZON_DAYS`, and not
 * listed in `BOOKING_BLACKOUT_DATES`.
 *
 * Used both to disable calendar days and to validate a submitted date, so a
 * stale modal can never send a past date or a weekend.
 */
export function isDateAvailable(date: Date): boolean {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (!isBookingWeekday(date)) return false;

  const day = startOfBookingDay(date);
  const earliest = addBookingDays(new Date(), BOOKING_MIN_LEAD_DAYS);
  const latest = addBookingDays(new Date(), BOOKING_HORIZON_DAYS);

  if (day.getTime() < earliest.getTime()) return false;
  if (day.getTime() > latest.getTime()) return false;

  return !BOOKING_BLACKOUT_DATES.includes(bookingDateKey(day));
}

/** e.g. "Tuesday, 24 September 2026" (as observed in Accra). */
export function formatBookingDate(date: Date): string {
  const parts = accraLongDateFormatter.formatToParts(date);
  return `${getPart(parts, "weekday")}, ${getPart(parts, "day")} ${getPart(
    parts,
    "month",
  )} ${getPart(parts, "year")}`;
}

/** e.g. "Tuesday, 24 September 2026 - 10:00 GMT (Accra)". */
export function formatBookingWhen(date: Date, slot: string): string {
  return `${formatBookingDate(date)} - ${slot} ${BOOKING_TIME_ZONE_LABEL}`;
}

export type BookingMessageInput = {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  location?: string;
  date?: Date;
  slot?: string;
  notes?: string;
};

/**
 * Optional presets a trigger can pass when opening the booking modal - e.g. the
 * interior page's CTA preselects the "Interior design" service.
 */
export type BookingPrefill = {
  service?: BookingService;
};

/**
 * Plain-text summary of a booking request. Used for the WhatsApp hand-off while
 * online submission is disabled - nothing leaves the browser unless the visitor
 * chooses to send it.
 */
export function buildBookingMessage(input: BookingMessageInput): string {
  const lines: string[] = [
    "Hello CASA Premier, I would like to book a consultation.",
  ];

  const when =
    input.date && input.slot
      ? formatBookingWhen(input.date, input.slot)
      : input.date
        ? formatBookingDate(input.date)
        : input.slot;

  const details: Array<[string, string | undefined]> = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Service", input.service],
    ["Project location", input.location],
    ["Preferred date & time", when],
    ["Notes", input.notes],
  ];

  const present = details.filter(
    ([, value]) => value !== undefined && value.trim().length > 0,
  );

  if (present.length > 0) {
    lines.push("");
    for (const [label, value] of present) {
      lines.push(`${label}: ${value?.trim()}`);
    }
  }

  return lines.join("\n");
}

/** Prefilled WhatsApp link (the visitor's own app sends it - no backend). */
export function bookingWhatsAppHref(input: BookingMessageInput): string {
  return `https://wa.me/${BOOKING_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    buildBookingMessage(input),
  )}`;
}

