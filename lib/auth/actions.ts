"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./next-path";
import {
  PASSWORD_MESSAGES,
  checkNewPassword,
  passwordUpdateProblem,
  type SetPasswordState,
} from "./password-state";
import {
  MESSAGES,
  emailLinkResult,
  looksLikeEmail,
  normalizeEmail,
  passwordErrorMessage,
  type EmailLinkState,
  type PasswordState,
} from "./sign-in-state";
import { requireUser } from "./user";

/**
 * Emails a sign-in link (supabase/templates/magic-link.html). It never creates an account: people
 * become members by joining, so an unknown address just gets no email.
 */
export async function sendSignInLink(
  _previous: EmailLinkState,
  formData: FormData,
): Promise<EmailLinkState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) {
    return { status: "error", email, message: MESSAGES.emailMissing };
  }
  if (!looksLikeEmail(email)) {
    return { status: "error", email, message: MESSAGES.emailInvalid };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    const result = emailLinkResult(email, error);
    if (error?.code === "over_email_send_rate_limit") {
      // The form still says "sent" (see emailLinkResult). Supabase uses this code both for a
      // repeat request soon after the last link and for the project's hourly email cap, when no
      // email goes out at all, so log it: a day that hits the cap then shows up in the logs.
      console.warn(
        "A sign-in link wasn't sent (Supabase email rate limit):",
        error.code,
        error.message,
      );
    }
    if (result.status === "error" && result.message === MESSAGES.unavailable) {
      console.error("Sending a sign-in link failed:", error?.code, error?.message);
    }
    return result;
  } catch (cause) {
    console.error("Sending a sign-in link failed:", cause);
    return { status: "error", email, message: MESSAGES.unavailable };
  }
}

/**
 * Finishes signing in from an emailed link, when the member presses the button on the page the link
 * opens (app/(site)/auth/confirm/page.tsx). Verifying the link's one-time token hash here, on the
 * server, starts the session, so the link works on whichever device opens it. Opening the link
 * doesn't verify anything, so mail systems that open links to scan them can't use it up.
 */
export async function confirmSignIn(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  let signedIn = false;

  if (typeof tokenHash === "string" && tokenHash !== "") {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
      signedIn = !error;
      // "otp_expired" covers links that are used, expired or made up. Anything else is a fault.
      if (error && error.code !== "otp_expired") {
        console.error("Finishing an email-link sign-in failed:", error.code, error.message);
      }
    } catch (cause) {
      console.error("Finishing an email-link sign-in failed:", cause);
    }
  }

  // Outside the try block: redirect() works by throwing.
  redirect(signedIn ? safeNextPath(formData.get("next")) : "/sign-in?error=link-expired");
}

/** Signs in with an email address and password, then goes to the page that asked (`next`). */
export async function signInWithPassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  if (!email || typeof password !== "string" || password === "") {
    return { status: "error", email, message: MESSAGES.passwordMissing };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = passwordErrorMessage(error);
      if (message === MESSAGES.unavailable) {
        console.error("Password sign-in failed:", error.code, error.message);
      }
      return { status: "error", email, message };
    }
  } catch (cause) {
    console.error("Password sign-in failed:", cause);
    return { status: "error", email, message: MESSAGES.unavailable };
  }

  // Outside the try block: redirect() works by throwing.
  redirect(safeNextPath(formData.get("next")));
}

/**
 * Sets a new password for the signed-in member: a first one (members who join online or are
 * imported start with email links only), a change, or a replacement for a forgotten one after
 * signing in with an email link. Supabase Auth also ends the member's other sessions.
 */
export async function setPassword(
  _previous: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  // Anyone can call a Server Function, so check the session here, not only on the page.
  await requireUser("/account/password");

  const check = checkNewPassword(formData.get("password"), formData.get("confirm"));
  if (!check.ok) {
    return { status: "error", field: check.field, message: check.message };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: check.password });
    if (error) {
      const problem = passwordUpdateProblem(error);
      if (problem.message === PASSWORD_MESSAGES.unavailable) {
        console.error("Setting a password failed:", error.code, error.message);
      }
      return { status: "error", ...problem };
    }
  } catch (cause) {
    console.error("Setting a password failed:", cause);
    return { status: "error", field: "password", message: PASSWORD_MESSAGES.unavailable };
  }
  return { status: "saved" };
}

/** Signs out on this device only (other devices stay signed in) and returns to the home page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    // With scope "local", Supabase clears this device's session cookies before it calls the Auth
    // server, so the member is signed out here even when that call fails.
    console.error("Revoking the session on sign-out failed:", error.code, error.message);
  }
  redirect("/");
}
