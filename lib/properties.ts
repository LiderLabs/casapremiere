// Property types and pure helpers for both public sites.
//
// Since Phase 7 the catalogue lives in the database, not here: `/` reads published rows
// through lib/cms/public.ts and hands them to components/property/property-provider.tsx, and
// `/interior` reads them directly. So this file now holds only what a component may import
// without touching a database client:
//
// - the `Property` / `PropertyStatus` / `PropertyHighlight` types,
// - `PROPERTY_STATUSES` and `PROPERTY_HIGHLIGHT_ICONS`, the two closed sets the admin's zod
//   schemas and the database's CHECK constraints also read,
// - `findPropertyBySlug(properties, slug)` — the pure lookup the provider, the drawer and the
//   shortlist panel use on the catalogue they were handed,
// - `PROPERTY_HOST` and `getPropertyPriceValue()`.
//
// `PROPERTIES` stays as the seed source for `npm run migrate:properties` and as the pixel
// baseline for the Phase 7 gate. Nothing in the app reads it any more.
//
// Authoring notes:
// - `meta` / `price` render exactly as written on the card and in the drawer, so leave them
//   as placeholders until the figures are confirmed.
// - The drawer hides a price that contains no digits (so "GH₵ --" never shows as a headline)
//   and groups spec rows with an empty `value` into a single "On request" line.
// - `hero` is the image shown in the drawer; `image` is the card image.

import { BOOKING_EMAIL, BOOKING_PHONE_DISPLAY } from "@/lib/booking";

/**
 * The four values the card and the drawer know how to render.
 *
 * This tuple is the runtime copy of the `PropertyStatus` union below. It exists so the four
 * strings are written once: the admin's zod schemas (lib/cms/validation.ts) and the database's
 * CHECK constraint (lib/cms/schema.ts) both read this list, so a fifth status cannot appear in
 * one place and not the others.
 */
export const PROPERTY_STATUSES = [
  "Available",
  "Under construction",
  "Sold",
  "Coming soon",
] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export type PropertyImage = { src: string; alt: string };

/**
 * The six icon keys `HIGHLIGHT_ICONS` in components/property/property-drawer.tsx resolves.
 * Adding one here is a compile error there until the map has an icon for it, which is exactly
 * the coupling that should exist between "what an editor can choose" and "what the drawer draws".
 */
export const PROPERTY_HIGHLIGHT_ICONS = [
  "space",
  "light",
  "joinery",
  "outdoor",
  "comfort",
  "detail",
] as const;

export type PropertyHighlightIcon = (typeof PROPERTY_HIGHLIGHT_ICONS)[number];

export type PropertyHighlight = {
  /** Icon key resolved by HIGHLIGHT_ICONS in the drawer. */
  icon: PropertyHighlightIcon;
  title: string;
  description: string;
};

export type PropertySpec = { label: string; value: string };

export type Property = {
  id: number;
  slug: string;
  name: string;
  location: string;
  status: PropertyStatus;
  /** Card specification line. */
  meta: string;
  price: string;
  /** Card description. */
  description: string;
  intro: string[];
  highlights: PropertyHighlight[];
  specs: PropertySpec[];
  amenities: string[];
  image: string;
  hero: PropertyImage;
  gallery: PropertyImage[];
};

/**
 * The bits of a media row this rule needs. A structural subset, so the admin's `MediaRecord` and
 * the public read path's rows can both be passed without importing a database module here.
 */
export type PropertyMediaLike = {
  role: "card" | "hero" | "gallery";
  r2Key: string;
  alt: string;
  position: number;
};

/**
 * Media rows → the three image fields `Property` carries. One rule, two callers: the server read
 * path (lib/cms/public.ts, resolving keys to public URLs) and the admin's preview, which has no
 * database and resolves them with the client-safe `mediaSrcClient` instead. `src` is injected for
 * exactly that reason — the rule about *which* row becomes which image is not up for re-deciding.
 */
export function toPropertyImages(
  media: readonly PropertyMediaLike[],
  src: (key: string) => string,
  fallbackAlt: string,
): { image: string; hero: PropertyImage; gallery: PropertyImage[] } {
  const card = media.find((item) => item.role === "card");
  const hero = media.find((item) => item.role === "hero");
  const gallery = media
    .filter((item) => item.role === "gallery")
    .sort((a, b) => a.position - b.position);

  return {
    image: card ? src(card.r2Key) : "",
    hero: {
      // A property with only a card image still needs an opening shot, and the card image is the
      // one image every published home is guaranteed to have.
      src: src((hero ?? card)?.r2Key ?? ""),
      alt: hero?.alt || card?.alt || fallbackAlt,
    },
    gallery: gallery.map((item) => ({ src: src(item.r2Key), alt: item.alt || fallbackAlt })),
  };
}

export const PROPERTY_HOST = {
  name: "CASA Premier",
  role: "Sales & viewings",
  phone: BOOKING_PHONE_DISPLAY,
  email: BOOKING_EMAIL,
};

/**
 * The standard spec rows and amenities, and therefore the starting point for a new home in the
 * admin (lib/cms/queries.ts seeds a draft with them). Empty values are normal: the drawer groups
 * them into the single "On request" line until a figure is filled in, so a draft looks like a
 * real listing from the first save rather than an empty shell.
 */
export const PROPERTY_DEFAULT_SPECS: PropertySpec[] = [
  { label: "Bedrooms", value: "" },
  { label: "Bathrooms", value: "" },
  { label: "Built area", value: "" },
  { label: "Plot", value: "" },
  { label: "Type", value: "Detached residence" },
  { label: "Parking", value: "Covered parking" },
  { label: "Garden", value: "Landscaped" },
  { label: "Security", value: "24/7 estate security" },
  { label: "Water", value: "Borehole supply" },
  { label: "Completion", value: "" },
];

export const PROPERTY_DEFAULT_AMENITIES = [
  "Landscaped garden",
  "Covered parking",
  "24/7 security",
  "Borehole water supply",
  "Fitted kitchen",
  "Built-in wardrobes",
  "Private terrace",
];

/**
 * The hand-written catalogue, kept as the seed source for `npm run migrate:properties` and as
 * the pixel baseline for the Phase 7 gate. The app does not read it: `/` and `/interior` read
 * published rows from the database, and the pure lookup below takes the catalogue as an
 * argument.
 */
export const PROPERTIES: Property[] = [
  {
    id: 1,
    slug: "the-residence",
    name: "The Residence",
    location: "Adjiringanor, Accra",
    status: "Available",
    meta: "Bedroom-",
    price: "GH₵ --",
    description:
      "A contemporary residence combining generous living spaces, refined finishes and seamless indoor-outdoor living.",
    intro: [
      "A private residence in Adjiringanor, planned around generous living space and a calm, uncluttered interior. Living, dining and kitchen sit in one continuous volume that opens onto the garden, so the rooms feel larger than their footprint.",
      "Finishes are chosen for how they age rather than how they photograph: warm neutrals, natural texture and joinery made to measure for the space it occupies.",
    ],
    highlights: [
      {
        icon: "space",
        title: "Generous living space",
        description:
          "Open-plan living and dining that flows straight out to the garden.",
      },
      {
        icon: "light",
        title: "Designed around light",
        description:
          "Large openings and considered orientation through the day.",
      },
      {
        icon: "joinery",
        title: "Fitted joinery",
        description: "Kitchen, wardrobes and storage made to measure.",
      },
      {
        icon: "outdoor",
        title: "Indoor-outdoor living",
        description: "Principal rooms open onto a private terrace.",
      },
    ],
    specs: PROPERTY_DEFAULT_SPECS,
    amenities: PROPERTY_DEFAULT_AMENITIES,
    image: "/images/model1.jpg",
    hero: {
      src: "/images/model1.jpg",
      alt: "The Residence — exterior view, Adjiringanor, Accra",
    },
    gallery: [
      {
        src: "/images/featured1.jpg",
        alt: "The Residence — living space",
      },
      { src: "/images/featured2.jpg", alt: "The Residence — facade detail" },
      { src: "/images/featured3.jpg", alt: "The Residence — garden frontage" },
      { src: "/images/featured4.jpg", alt: "The Residence — interior view" },
      { src: "/images/model1.jpg", alt: "The Residence — terrace" },
      { src: "/images/featured4.jpg", alt: "The Residence — approach" },
    ],
  },
  {
    id: 2,
    slug: "the-premier-home",
    name: "The Premier home",
    location: "Adjiringanor, Accra",
    status: "Available",
    meta: "Bedroom--",
    price: "GH₵---",
    description:
      "Sophisticated city living with carefully considered interiors, premium finishes and exceptional attention to detail.",
    intro: [
      "A city home where the plan does the work: rooms are arranged around the way a household actually moves, so circulation is short, storage is where you need it, and the living space stays quiet even when the house is busy.",
      "Interiors are deliberately restrained — a considered material palette, well-proportioned rooms and fittings selected for durability as much as finish.",
    ],
    highlights: [
      {
        icon: "space",
        title: "Considered layout",
        description: "Rooms planned around daily routines, not the drawing board.",
      },
      {
        icon: "comfort",
        title: "Comfort first",
        description: "Quiet bedrooms and generous storage throughout.",
      },
      {
        icon: "detail",
        title: "Premium finishes",
        description: "Materials and fittings chosen for how they age.",
      },
      {
        icon: "outdoor",
        title: "Private outdoor space",
        description: "A terrace for slow evenings and entertaining.",
      },
    ],
    specs: PROPERTY_DEFAULT_SPECS,
    amenities: PROPERTY_DEFAULT_AMENITIES,
    image: "/images/mono_1.jpg",
    hero: {
      src: "/images/mono_1.jpg",
      alt: "The Premier home — exterior view, Adjiringanor, Accra",
    },
    gallery: [
      { src: "/images/philosophy.jpg", alt: "The Premier home — living space" },
      { src: "/images/mono_3.jpg", alt: "The Premier home — facade detail" },
      { src: "/images/mono_1.jpg", alt: "The Premier home — evening view" },
      { src: "/images/mono_4.jpg", alt: "The Premier home — interior view" },
      { src: "/images/mono_2.jpg", alt: "The Premier home — terrace" },
    ],
  },
  {
    id: 3,
    slug: "the-heights",
    name: "The Heights",
    location: "Adjiringanor, Accra",
    status: "Available",
    meta: "Bedrooms --",
    price: "GH₵---",
    description:
      "A modern private residence designed around natural light, privacy and effortless entertaining.",
    intro: [
      "Set back from the street and screened by planting, The Heights is arranged so that every principal room stays bright while the house keeps its privacy from the road.",
      "Living, dining and kitchen are drawn together as one entertaining space that opens outward, with the more private rooms held quietly apart.",
    ],
    highlights: [
      {
        icon: "light",
        title: "Natural light",
        description: "A plan that keeps every principal room bright.",
      },
      {
        icon: "outdoor",
        title: "Private and calm",
        description: "Screened from the street, opening to its own courtyard.",
      },
      {
        icon: "comfort",
        title: "Effortless entertaining",
        description: "Living, dining and kitchen arranged to work together.",
      },
      {
        icon: "detail",
        title: "Attention to detail",
        description: "Considered interiors, from ceilings to thresholds.",
      },
    ],
    specs: PROPERTY_DEFAULT_SPECS,
    amenities: PROPERTY_DEFAULT_AMENITIES,
    image: "/images/hero-bg1.jpg",
    hero: {
      src: "/images/hero-bg1.jpg",
      alt: "The Heights — exterior view, Adjiringanor, Accra",
    },
    gallery: [
      { src: "/images/herobg3.jpg", alt: "The Heights — living space" },
      { src: "/images/herobg2.jpg", alt: "The Heights — facade detail" },
      { src: "/images/herobg4.jpg", alt: "The Heights — aerial view" },
      { src: "/images/side1.jpg", alt: "The Heights — interior view" },
      { src: "/images/side2.jpg", alt: "The Heights — courtyard" },
    ],
  },
];

/**
 * Slug lookup against the catalogue a component was handed — the `?property=` deep link, the
 * drawer's pager and the shortlist panel's ordering all go through this, so there is no
 * module-level list to fall out of step with the database.
 */
export function findPropertyBySlug(
  properties: readonly Property[],
  slug: string,
): Property | undefined {
  return properties.find((property) => property.slug === slug);
}

/**
 * The number behind a display price, or `undefined` while it is still a
 * placeholder.
 *
 * This follows the same rule the drawer applies ("a price with no digits is
 * unfinished"), so `"GH₵ --"` yields nothing and the affordability calculator
 * opens with an empty field rather than a guess.
 *
 * Only plain digit groups are accepted - `"GH₵ 2,400,000"` and `"2.400.000"`
 * both parse, but a shorthand such as `"GH₵ 2.4M"` is deliberately refused
 * rather than interpreted, so the calculator never starts from a wrong number.
 */
export function getPropertyPriceValue(price: string): number | undefined {
  if (!/\d/.test(price)) return undefined;

  const digits = price.replace(/GH₵|GH¢|GHS/gi, "").replace(/\s/g, "");

  if (!/^\d{1,3}(?:[,.]\d{3})*$/.test(digits) && !/^\d+$/.test(digits)) {
    return undefined;
  }

  const value = Number(digits.replace(/[,.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}


