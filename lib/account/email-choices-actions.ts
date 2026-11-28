"use server";

import { requireUser } from "@/lib/auth/user";
import { serverEnv } from "@/lib/env/server";
import { getMailerLiteClient, MAILERLITE_ENV } from "@/lib/mailerlite/client";
import { saveEmailChoices } from "@/lib/mailerlite/topics";
import { ACCOUNT_PATH } from "@/lib/site/navigation";
import { memberAddress } from "./email-choices";
import {
  EMAIL_CHOICES_MESSAGES,
  readEmailChoicesForm,
  type EmailChoicesFormState,
} from "./email-choices-state";

/**
 * Saves the email switches on My Account (decision 0016): the signed-in member's own place in
 * MailerLite's Newsletter and Event announcements groups (lib/mailerlite/topics.ts). MailerLite
 * keeps the choices; the site stores nothing. Logs never get the member's address.
 */
export async function saveEmailChoicesAction(
  previous: EmailChoicesFormState,
  formData: FormData,
): Promise<EmailChoicesFormState> {
  // Anyone can call a Server Function, so check the session here, not only on the page.
  const user = await requireUser(ACCOUNT_PATH);
  const choices = readEmailChoicesForm(formData);
  const unavailable: EmailChoicesFormState = {
    status: "error",
    message: EMAIL_CHOICES_MESSAGES.unavailable,
    choices,
    ...(previous.status === "idle" ? {} : { paused: previous.paused }),
  };

  try {
    // Null while MAILERLITE_API_KEY isn't set: the switches are hidden then, but a page loaded
    // before, or a request made by hand, can still get here.
    const client = getMailerLiteClient(serverEnv(...MAILERLITE_ENV));
    if (!client) return unavailable;
    const member = await memberAddress(user);
    if (!member) return unavailable;
    return { status: "saved", ...(await saveEmailChoices(client, member, choices)) };
  } catch (error) {
    console.error(
      "Saving a member's email choices failed:",
      error instanceof Error ? error.message : String(error),
    );
    return unavailable;
  }
}
