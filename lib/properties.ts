// Property data — single source of truth for the "Featured Properties" grid
// (components/sections/collection-section.tsx) and the quick-view drawer
// (components/property/property-drawer.tsx).
//
// Authoring notes:
// - `meta` / `price` render exactly as written on the card and in the drawer,
//   so leave them as placeholders until the figures are confirmed.
// - The drawer hides a price that contains no digits (so "GH₵ --" never shows
//   as a headline) and groups spec rows with an empty `value` into a single
//   "On request" line. Fill a value in and it appears on its own row.
// - `hero` is the image shown in the drawer; `image` is the card image.

import { BOOKING_EMAIL, BOOKING_PHONE_DISPLAY } from "@/lib/booking";

export type PropertyStatus =
  | "Available"
  | "Under construction"
  | "Sold"
  | "Coming soon";

export type PropertyImage = { src: string; alt: string };

export type PropertyHighlight = {
  /** Icon key resolved by HIGHLIGHT_ICONS in the drawer. */
  icon: "space" | "light" | "joinery" | "outdoor" | "comfort" | "detail";
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

export const PROPERTY_HOST = {
  name: "CASA Premier",
  role: "Sales & viewings",
  phone: BOOKING_PHONE_DISPLAY,
  email: BOOKING_EMAIL,
};

const BASE_SPECS: PropertySpec[] = [
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

const BASE_AMENITIES = [
  "Landscaped garden",
  "Covered parking",
  "24/7 security",
  "Borehole water supply",
  "Fitted kitchen",
  "Built-in wardrobes",
  "Private terrace",
];

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
    specs: BASE_SPECS,
    amenities: BASE_AMENITIES,
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
    specs: BASE_SPECS,
    amenities: BASE_AMENITIES,
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
    specs: BASE_SPECS,
    amenities: BASE_AMENITIES,
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

/** Look up a property by slug (used for the ?property= deep link). */
export function getPropertyBySlug(slug: string): Property | undefined {
  return PROPERTIES.find((property) => property.slug === slug);
}

