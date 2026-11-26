// Form state for setting a password, the rules a new password must meet, and the wording members
// see for each outcome. Kept free of server code so the form and the unit tests can import it.

import type { AuthErrorLike } from "./sign-in-state";

/**
 * New passwords need at least this many characters. Supabase Auth refuses shorter ones too
 * (auth.minimum_password_length in supabase/config.jsonc); a unit test keeps the two in step.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Supabase Auth refuses passwords over 72 bytes, the most its password hashing (bcrypt) reads. */
export const MAX_PASSWORD_BYTES = 72;

export type PasswordField = "password" | "confirm";

export type SetPasswordState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; field: PasswordField; message: string };

type Problem = { field: PasswordField; message: string };

export type NewPasswordCheck = { ok: true; password: string } | ({ ok: false } & Problem);

export const PASSWORD_MESSAGES = {
  hint: `At least ${MIN_PASSWORD_LENGTH} characters. A few words strung together are easy to remember and hard to guess.`,
  missing: "Enter a new password.",
  tooShort: `That password is too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  tooLong: "That password is too long. Use 72 characters or fewer.",
  confirmMissing: "Type the new password again.",
  mismatch: "The two passwords don't match. Type the same new password in both boxes.",
  weak: "That password is too easy to guess. Choose a longer one.",
  samePassword: "That's already your password. To change it, choose a different one.",
  signInAgain: "For your security, sign out and sign in again, then set your password.",
  tooManyAttempts: "Too many tries. Wait a few minutes, then try again.",
  unavailable: "Your password couldn't be saved right now. Please try again in a few minutes.",
} as const;

/**
 * Checks a new password and its confirmation the way Supabase Auth will, so members get a clear
 * message instead of a refusal. Characters are counted as Supabase counts them: the length as
 * Unicode characters (an emoji is one), the limit in UTF-8 bytes (an emoji is four).
 */
export function checkNewPassword(
  password: FormDataEntryValue | null,
  confirm: FormDataEntryValue | null,
): NewPasswordCheck {
  if (typeof password !== "string" || password === "") {
    return { ok: false, field: "password", message: PASSWORD_MESSAGES.missing };
  }
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return { ok: false, field: "password", message: PASSWORD_MESSAGES.tooShort };
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return { ok: false, field: "password", message: PASSWORD_MESSAGES.tooLong };
  }
  if (typeof confirm !== "string" || confirm === "") {
    return { ok: false, field: "confirm", message: PASSWORD_MESSAGES.confirmMissing };
  }
  if (confirm !== password) {
    return { ok: false, field: "confirm", message: PASSWORD_MESSAGES.mismatch };
  }
  return { ok: true, password };
}

/** What to tell a member whose new password Supabase refused. */
export function passwordUpdateProblem(error: AuthErrorLike): Problem {
  switch (error.code) {
    case "weak_password":
      // Only when Supabase's rules are stricter than checkNewPassword's, as a hosted project's can be.
      return { field: "password", message: PASSWORD_MESSAGES.weak };
    case "same_password":
      return { field: "password", message: PASSWORD_MESSAGES.samePassword };
    case "reauthentication_needed":
      // Only if "Secure password change" is turned on: then sessions older than a day can't change it.
      return { field: "password", message: PASSWORD_MESSAGES.signInAgain };
    case "over_request_rate_limit":
      return { field: "password", message: PASSWORD_MESSAGES.tooManyAttempts };
    default:
      return { field: "password", message: PASSWORD_MESSAGES.unavailable };
  }
}
