"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField, Fieldset, FormError, SuccessBox } from "@/components/ui/form-fields";
import {
  EMAIL_CHOICES_MESSAGES,
  type EmailChoicesFormState,
} from "@/lib/account/email-choices-state";
import type { EmailChoicesState } from "@/lib/mailerlite/topics";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type SaveEmailChoicesAction = (
  state: EmailChoicesFormState,
  formData: FormData,
) => Promise<EmailChoicesFormState>;

/**
 * The member's two email switches on My Account (decision 0016): Monthly newsletter and Event
 * announcements, as MailerLite has them.
 */
export function EmailChoicesForm({
  action,
  initial,
}: {
  action: SaveEmailChoicesAction;
  /** The choices as MailerLite has them when the page loads. */
  initial: EmailChoicesState;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // React resets the form after each submission, back to each switch's default: what was saved, or
  // what was sent after a problem.
  const choices = state.status === "idle" ? initial.choices : state.choices;
  const paused = state.status === "idle" ? initial.paused : (state.paused ?? initial.paused);

  return (
    <form action={formAction} className="mt-4">
      {paused && <p className="mb-4 text-sm">{EMAIL_CHOICES_MESSAGES.paused}</p>}
      <Fieldset legend="Email me">
        <CheckboxField
          label="Monthly newsletter"
          name="newsletter"
          hint={EMAIL_CHOICES_MESSAGES.newsletterHint}
          defaultChecked={choices.newsletter}
        />
        <CheckboxField
          label="Event announcements"
          name="events"
          hint={EMAIL_CHOICES_MESSAGES.eventsHint}
          defaultChecked={choices.events}
        />
      </Fieldset>
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
        {pending ? "Saving…" : "Save email choices"}
      </Button>
      {/* Hidden while the form sends again, so a repeated message is a new alert, read out again. */}
      {!pending && state.status === "error" && (
        <FormError className="mt-2">{state.message}</FormError>
      )}
      {/* Always in the page, so screen readers announce the message when it appears. Emptied while
          the form sends again, so the same message is announced again. */}
      <div role="status" className="mt-4 empty:mt-0">
        {!pending && state.status === "saved" && (
          <SuccessBox>{EMAIL_CHOICES_MESSAGES.saved}</SuccessBox>
        )}
      </div>
      <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
        {EMAIL_CHOICES_MESSAGES.membershipEmails}
      </p>
    </form>
  );
}
