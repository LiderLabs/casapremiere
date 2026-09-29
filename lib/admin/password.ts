// Password hashing - server-only, because @node-rs/argon2 is native.
//
// The policy half (length, deny-list, username/name checks) lives in lib/admin/password-policy.ts
// and is re-exported below, so callers need one import while client components import only the
// policy module.
//
// Imports here are kept alias-free where they matter to the CLI scripts
// (scripts/admin-create-user.ts, scripts/admin-reset-password.ts), which run under plain tsx.

import { createHash } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

import {
  checkPasswordPolicy,
  normalizeUsername,
  PASSWORD_MIN_LENGTH,
} from "@/lib/admin/password-policy";

export { checkPasswordPolicy, normalizeUsername, PASSWORD_MIN_LENGTH };
export type { PasswordPolicyResult } from "@/lib/admin/password-policy";

/**
 * 2 = Argon2id. Spelled as a number because @node-rs/argon2 exports `Algorithm` as an ambient
 * const enum, which `isolatedModules` (this repo) refuses to read.
 */
const ARGON2ID = 2;

/** argon2id at the OWASP baseline (19 MiB, 2 iterations). */
const ARGON_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A valid hash of a value nobody knows, verified against when the username does not exist,
 * so "no such user" and "wrong password" cost the same and cannot be told apart by timing.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$uecsxWuhSu5PRP95WBg+eg$R/gjn4C9LjWxiEfpA+SxN8I/sr/oovfiuugOX2EJBMc";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON_OPTIONS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hashValue, password);
  } catch {
    // A malformed hash must read as "wrong password", never as a crash.
    return false;
  }
}

/** Spends the same work as a real check, for a username that does not exist. */
export async function burnDummyPasswordCheck(): Promise<void> {
  await verifyPassword(DUMMY_HASH, "not-the-password");
}

// Policy (length, deny-list, username/name checks) lives in lib/admin/password-policy.ts and is
// re-exported at the top of this file.
