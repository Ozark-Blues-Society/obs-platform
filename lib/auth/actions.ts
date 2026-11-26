"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./next-path";
import {
  MESSAGES,
  emailLinkResult,
  looksLikeEmail,
  normalizeEmail,
  passwordErrorMessage,
  type EmailLinkState,
  type PasswordState,
} from "./sign-in-state";

/**
 * Emails a one-click sign-in link (supabase/templates/magic-link.html). It never creates an
 * account: people become members by joining, so an unknown address just gets no email.
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
    if (result.status === "error" && result.message === MESSAGES.unavailable) {
      console.error("Sending a sign-in link failed:", error?.code, error?.message);
    }
    return result;
  } catch (cause) {
    console.error("Sending a sign-in link failed:", cause);
    return { status: "error", email, message: MESSAGES.unavailable };
  }
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
