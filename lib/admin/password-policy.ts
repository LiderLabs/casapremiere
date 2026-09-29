// Password *policy* - pure, dependency-free, and the only file in lib/admin a client component
// may import.
//
// The rest of the password code lives in lib/admin/password.ts, which pulls in @node-rs/argon2
// (server-only). Importing that from a client component fails the production build, because
// argon2's browser build exports nothing - which is exactly what happened the first time the
// password form needed PASSWORD_MIN_LENGTH for its hint text.

export const PASSWORD_MIN_LENGTH = 12;

/** The handful of strings people actually reach for on a client site. */
export const PASSWORD_DENY_LIST = [
  "casapremier",
  "casapremiere",
  "password",
  "123456789012",
  "qwertyuiop12",
  "casaadmin",
];

export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export type PasswordPolicyResult = { ok: true } | { ok: false; message: string };

/**
 * Length over composition (NIST): 12+ characters, don't contain your own name or username,
 * and don't be one of the handful of obvious strings.
 */
export function checkPasswordPolicy(
  password: string,
  context: { username: string; name?: string },
): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  const lower = password.toLowerCase();
  const username = normalizeUsername(context.username);
  const name = context.name?.trim().toLowerCase() ?? "";

  if (username.length >= 3 && lower.includes(username)) {
    return { ok: false, message: "Do not include your username in the password." };
  }
  if (name.length >= 3 && lower.includes(name)) {
    return { ok: false, message: "Do not include your name in the password." };
  }
  if (PASSWORD_DENY_LIST.some((entry) => lower.includes(entry))) {
    return { ok: false, message: "That password is too predictable. Choose another." };
  }

  return { ok: true };
}
