// The email switches on My Account (decision 0016): the wording and form state that the form and
// its Server Function share. No server code, so the form and the tests can use it.
import type { EmailChoices, EmailChoicesState } from "@/lib/mailerlite/topics";

export type EmailChoicesFormState =
  | { status: "idle" }
  | ({ status: "saved" } & EmailChoicesState)
  | {
      status: "error";
      message: string;
      /** What was sent, so the switches keep it: React resets a form after each submission. */
      choices: EmailChoices;
      /** Whether the last save left the member paused; unknown before one. */
      paused?: boolean;
    };

export const EMAIL_CHOICES_MESSAGES = {
  newsletterHint: "New blog posts and upcoming shows, once a month.",
  eventsHint: "Shows and events, as they're announced.",
  paused:
    "The Society's newsletter and announcements aren't reaching you right now. Choose what you'd like and select Save to get them again.",
  membershipEmails: "Emails about your membership, such as renewal reminders, come either way.",
  saved: "Your email choices are saved.",
  unavailable: "Your email choices couldn't be saved right now. Please try again in a few minutes.",
  cantShow: "Your email choices can't be shown right now. Please try again in a few minutes.",
} as const;

/** The switches from a submission: a checkbox is in the form only when it's on. */
export function readEmailChoicesForm(formData: FormData): EmailChoices {
  return { newsletter: formData.has("newsletter"), events: formData.has("events") };
}
