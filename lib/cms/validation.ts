// Shared zod schemas — the contract the admin forms and the route handlers both validate
// against (docs/cms-build-spec.md §7.2: "one zod schema per write path, reused by the form").
//
// Client-safe on purpose: `react-hook-form` + `@hookform/resolvers/zod` are already
// dependencies, and a screen may import these so the rule the browser enforces is literally
// the rule the server re-checks. Nothing here may import a database client, a secret or a
// native module — the only import is the pure password policy.

import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/admin/password-policy";

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
