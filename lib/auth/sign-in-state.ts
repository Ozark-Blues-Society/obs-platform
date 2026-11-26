// Form state for the sign-in forms, and the wording members see for each outcome. Kept free of
// server code so the forms and the unit tests can import it.

export type EmailLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; email: string; message: string };

export type PasswordState =
  { status: "idle" } | { status: "error"; email: string; message: string };

/** The part of a Supabase AuthError the forms care about. */
export type AuthErrorLike = { code?: string; status?: number; message?: string };

export const MESSAGES = {
  emailMissing: "Enter your email address.",
  emailInvalid: "Enter an email address like name@example.com.",
  passwordMissing: "Enter your email address and password.",
  wrongPassword:
    "That email and password don't match. Check them and try again, or email yourself a sign-in link instead.",
  emailNotConfirmed:
    "This email address hasn't been confirmed yet, so it can't sign in. Please contact the Society for help.",
  tooManyAttempts: "Too many sign-in attempts. Wait a few minutes, then try again.",
  unavailable: "Sign-in isn't working right now. Please try again in a few minutes.",
  linkExpired:
    "That sign-in link has expired or was already used. Each link works once, for one hour. Request a new one below.",
} as const;

/** Trims the address and lowercases it, as Supabase stores it. */
export function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** A deliberately loose check: one @, something on both sides, a dot in the domain, no spaces. */
export function looksLikeEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * What to tell someone who asked for a sign-in link. The answer must not reveal whether the address
 * belongs to a member. So an unknown address ("otp_disabled": sign-in links never create accounts)
 * and a repeat request ("over_email_send_rate_limit": a link went out moments ago) both get the
 * same answer as success.
 */
export function emailLinkResult(email: string, error: AuthErrorLike | null): EmailLinkState {
  if (!error || error.code === "otp_disabled" || error.code === "over_email_send_rate_limit") {
    return { status: "sent", email };
  }
  if (error.code === "over_request_rate_limit") {
    return { status: "error", email, message: MESSAGES.tooManyAttempts };
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return { status: "error", email, message: MESSAGES.emailInvalid };
  }
  return { status: "error", email, message: MESSAGES.unavailable };
}

/** What to tell someone whose password sign-in failed. */
export function passwordErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "invalid_credentials":
      return MESSAGES.wrongPassword;
    case "email_not_confirmed":
      // Only reachable with the right password, so it gives nothing away.
      return MESSAGES.emailNotConfirmed;
    case "over_request_rate_limit":
      return MESSAGES.tooManyAttempts;
    default:
      return MESSAGES.unavailable;
  }
}
