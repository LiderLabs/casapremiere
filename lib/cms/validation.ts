// Shared zod schemas — the contract the admin forms and the route handlers both validate
// against (docs/cms-build-spec.md §7.2: "one zod schema per write path, reused by the form").
//
// Client-safe on purpose: `react-hook-form` + `@hookform/resolvers/zod` are already
// dependencies, and a screen may import these so the rule the browser enforces is literally
// the rule the server re-checks. Nothing here may import a database client, a secret or a
// native module — the only import is the pure password policy.

import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/admin/password-policy";
import { PROPERTY_HIGHLIGHT_ICONS, PROPERTY_STATUSES } from "@/lib/properties";
import { PROPERTY_MEDIA_ROLES } from "@/lib/cms/schema";

/** 3–32 characters; stored lowercased, so sign-in is case-insensitive without a collation. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use 3–32 characters: a–z 0–9 . _ -");

export const roleSchema = z.enum(["admin", "editor"]);
export const userStatusSchema = z.enum(["active", "disabled"]);

/**
 * A blank email means "no email", which is stored as NULL — an empty string would be a
 * distinct value and would collide with a second blank one under the unique index.
 */
export const optionalEmailSchema = z
  .union([z.literal(""), z.string().trim().toLowerCase().email("That email address is not valid.").max(160)])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const temporaryPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(256);

export const createUserSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().max(80).optional().default(""),
  email: optionalEmailSchema,
  role: roleSchema.default("editor"),
  /** Omit it and the server generates one; either way it is returned once, never stored in clear. */
  tempPassword: temporaryPasswordSchema.optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    role: roleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update.",
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** One human-readable sentence from a failed parse — what a `400 { error }` should carry. */
export function firstIssueMessage(error: z.ZodError): string {
  const [issue] = error.issues;
  return issue?.message ?? "That request could not be validated.";
}

/** Field-level detail for a form, keyed by the schema's own field names. */
export function fieldErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}

// ---------------------------------------------------------------------------------------
// Properties (docs/cms-build-spec.md §4, §6, §7.1)
//
// The four JSON columns mirror lib/properties.ts exactly — `intro: string[]`,
// `highlights: { icon, title, description }[]`, `specs: { label, value }[]`,
// `amenities: string[]` — and the two closed value sets (`status`, `icon`) are read from that
// file rather than retyped, so the admin can never offer an icon the drawer cannot draw or a
// status the public card cannot render.
// ---------------------------------------------------------------------------------------

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens, e.g. the-residence.",
  )
  .max(80);

export const propertyStatusSchema = z.enum(PROPERTY_STATUSES);
export const highlightIconSchema = z.enum(PROPERTY_HIGHLIGHT_ICONS);

export const propertyHighlightSchema = z.object({
  icon: highlightIconSchema,
  title: z.string().trim().min(1, "Give the highlight a title.").max(80),
  description: z.string().trim().min(1, "Describe the highlight.").max(240),
});

export const propertySpecSchema = z.object({
  label: z.string().trim().min(1, "Every spec needs a label.").max(60),
  /** Empty is allowed and meaningful: the drawer groups empty values into "On request". */
  value: z.string().trim().max(120),
});

/** The four JSON columns, each with a bound so one draft cannot grow a row without limit. */
export const propertyIntroSchema = z.array(z.string().trim().min(1).max(1200)).max(20);
export const propertyHighlightsSchema = z.array(propertyHighlightSchema).max(12);
export const propertySpecsSchema = z.array(propertySpecSchema).max(20);
export const propertyAmenitiesSchema = z.array(z.string().trim().min(1).max(80)).max(30);

/**
 * Every field a property can hold. `meta` and `price` are free text on purpose: the site's rule
 * is *"a value with no digits is unfinished and hidden"*, and that rule lives in the drawer, not
 * in the database — so nothing here tries to parse a figure.
 */
const propertyFields = {
  name: z.string().trim().min(1, "A name is required.").max(120),
  location: z.string().trim().min(1, "A location is required.").max(120),
  status: propertyStatusSchema,
  meta: z.string().trim().max(120),
  price: z.string().trim().max(120),
  description: z.string().trim().max(600),
  intro: propertyIntroSchema,
  highlights: propertyHighlightsSchema,
  specs: propertySpecsSchema,
  amenities: propertyAmenitiesSchema,
};

/**
 * A new property is a draft: only the three fields the admin list shows are required, and the
 * slug is derived from the name on the server (`The Premier home` → `the-premier-home`), never
 * accepted from the client.
 */
export const createPropertySchema = z.object({
  name: propertyFields.name,
  location: propertyFields.location,
  status: propertyFields.status.optional().default("Available"),
  meta: propertyFields.meta.optional().default(""),
  price: propertyFields.price.optional().default(""),
  description: propertyFields.description.optional().default(""),
  intro: propertyFields.intro.optional(),
  highlights: propertyFields.highlights.optional(),
  specs: propertyFields.specs.optional(),
  amenities: propertyFields.amenities.optional(),
});

/**
 * A partial update plus the optimistic-concurrency precondition: `updatedAt` is the value the
 * editor loaded, and a mismatch means somebody has saved since — a `409` naming them, rather
 * than a silent overwrite.
 */
export const updatePropertySchema = z
  .object({ ...propertyFields, updatedAt: z.string().min(1) })
  .partial()
  .required({ updatedAt: true })
  .refine((value) => Object.keys(value).some((key) => key !== "updatedAt"), {
    message: "Nothing to update.",
  });

/** The drag handle's payload: the complete catalogue, in its new order. */
export const reorderPropertiesSchema = z.object({
  slugs: z
    .array(z.string().min(1))
    .min(1, "There is nothing to reorder.")
    .max(200)
    .refine((list) => new Set(list).size === list.length, "A slug appears twice."),
});

// ---------------------------------------------------------------------------------------
// Business settings (docs/cms-build-spec.md §6, §7)
//
// The values the site currently hard-codes: the phone number, email, WhatsApp number, opening
// hours, address and the footer links. `footerLinks` is the one structured value, so it travels
// as JSON in a text column and is validated here rather than trusted by its reader.
// ---------------------------------------------------------------------------------------

export const SETTING_KEYS = [
  "phone",
  "email",
  "whatsapp",
  "hours",
  "address",
  "footerLinks",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_LABELS: Record<SettingKey, string> = {
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp number",
  hours: "Opening hours",
  address: "Address",
  footerLinks: "Footer links",
};

export const footerLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(300),
});

/**
 * One known key at a time — there is no generic "value" union, because a union would accept a
 * plain string for `footerLinks` and the reader would silently degrade it to `[]`. A mistyped
 * value must be refused (400), not stored and then forgotten.
 */
const textSetting = z.string().trim().max(600);

export const updateSettingsSchema = z
  .object({
    phone: textSetting.optional(),
    email: textSetting.optional(),
    whatsapp: textSetting.optional(),
    hours: textSetting.optional(),
    address: textSetting.optional(),
    footerLinks: z.array(footerLinkSchema).max(12).optional(),
  })
  // Unknown keys are refused by name, not stripped: "I saved footerLink" followed by nothing
  // happening is worse than an error that says which key is wrong.
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Nothing to save.",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type ReorderPropertiesInput = z.infer<typeof reorderPropertiesSchema>;

// ---------------------------------------------------------------------------------------
// Media uploads (docs/cms-build-spec.md §8 — Phase 6: the R2 pipeline)
// ---------------------------------------------------------------------------------------

export const propertyMediaRoleSchema = z.enum(PROPERTY_MEDIA_ROLES);

export const signUploadSchema = z.object({
  slug: slugSchema,
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  bytes: z.number().int().min(1).max(1_500_000),
});

export const confirmMediaSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^properties\/[a-z0-9-]+\/[a-f0-9]+\.(jpg|png|webp|avif)$/, "That upload key is not valid."),
  role: propertyMediaRoleSchema,
  alt: z.string().trim().max(240).default(""),
  width: z.number().int().min(1).max(8000).optional(),
  height: z.number().int().min(1).max(8000).optional(),
  bytes: z.number().int().min(1).max(1_500_000).optional(),
});

export const updateMediaSchema = z
  .object({
    role: propertyMediaRoleSchema.optional(),
    alt: z.string().trim().max(240).optional(),
  })
  .refine((value) => value.role !== undefined || value.alt !== undefined, {
    message: "Nothing to update.",
  });

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type ConfirmMediaInput = z.infer<typeof confirmMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
