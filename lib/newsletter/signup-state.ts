// The newsletter signup box on the blog (decision 0015): the checks and wording that the form and
// its Server Function share. No server code, so the form and the tests can use it.
import { looksLikeEmail, MESSAGES, normalizeEmail } from "@/lib/auth/sign-in-state";

export type SignupState =
  | { status: "idle" }
  | { status: "done" }
  | {
      status: "error";
      /** "email" for a problem with the address, null for one with sending it. */
      field: "email" | null;
      message: string;
      /** What was typed, so the field keeps it: React resets a form after each submission. */
      email: string;
    };

export const SIGNUP_MESSAGES = {
  emailMissing: MESSAGES.emailMissing,
  emailInvalid: MESSAGES.emailInvalid,
  // The same for every address, new to the list or not, so the box tells nobody who's on it.
  done: "Thanks for signing up! If you're new to our list, check your inbox for an email asking you to confirm your address. The digest starts once you do.",
  unavailable: "We couldn't sign you up just now. Please try again in a few minutes.",
} as const;

/**
 * A field people never see or reach (the form hides it), named so that form-filling bots put
 * something in it: a value there means a bot sent the form.
 */
export const TRAP_FIELD = "website";

/** The address from a submission, trimmed and lowercased, and whether the trap field was filled. */
export function readSignupForm(formData: FormData): { email: string; trapped: boolean } {
  const trap = formData.get(TRAP_FIELD);
  return {
    email: normalizeEmail(formData.get("email")),
    trapped: typeof trap === "string" && trap.trim() !== "",
  };
}

/** What's wrong with the address, or null when it looks like one. */
export function checkEmail(email: string): string | null {
  if (!email) return SIGNUP_MESSAGES.emailMissing;
  return looksLikeEmail(email) ? null : SIGNUP_MESSAGES.emailInvalid;
}
