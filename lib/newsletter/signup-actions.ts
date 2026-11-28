"use server";

import { serverEnv } from "@/lib/env/server";
import { getMailerLiteClient, MAILERLITE_ENV } from "@/lib/mailerlite/client";
import { subscribeToNewsletter } from "@/lib/mailerlite/topics";
import { checkEmail, readSignupForm, SIGNUP_MESSAGES, type SignupState } from "./signup-state";

/**
 * The newsletter signup box on the blog (decision 0015): adds the address to MailerLite's
 * Newsletter group, with MailerLite's double opt-in (lib/mailerlite/topics.ts). It goes through the
 * site's server: no MailerLite script on the page.
 *
 * Anyone can send it, so it says the same "done" for every address it passes on, whatever MailerLite
 * made of it, and for a bot that filled the trap field, which it doesn't pass on. Logs never get
 * the address.
 */
export async function signUpForNewsletter(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const { email, trapped } = readSignupForm(formData);
  const problem = checkEmail(email);
  if (problem) return { status: "error", field: "email", message: problem, email };
  if (trapped) return { status: "done" };

  const unavailable: SignupState = {
    status: "error",
    field: null,
    message: SIGNUP_MESSAGES.unavailable,
    email,
  };
  try {
    // Null while MAILERLITE_API_KEY isn't set: the box is hidden then, but a page loaded before,
    // or a request made by hand, can still get here.
    const client = getMailerLiteClient(serverEnv(...MAILERLITE_ENV));
    if (!client) return unavailable;
    if ((await subscribeToNewsletter(client, email)) === "refused") {
      console.info(
        "MailerLite refused a newsletter signup (422): an address it won't take, or someone who unsubscribed, bounced or marked a campaign as spam.",
      );
    }
  } catch (error) {
    console.error(
      "A newsletter signup failed:",
      error instanceof Error ? error.message : String(error),
    );
    return unavailable;
  }
  return { status: "done" };
}
