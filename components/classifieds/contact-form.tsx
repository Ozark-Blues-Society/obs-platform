"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, SuccessBox, TextareaField } from "@/components/ui/form-fields";
import type { ContactState } from "@/lib/listings/public-state";

// The Server Function arrives as a prop (from the listing's page), so the form can be tested on its
// own.
type ContactAction = (state: ContactState, formData: FormData) => Promise<ContactState>;

/**
 * Writes to a listing's poster through the site (backlog K-3). The site emails the message on with
 * the sender's name and address, so the poster can reply, without showing the poster's address.
 */
export function ContactForm({
  action,
  poster,
  senderEmail,
}: {
  action: ContactAction;
  /** "Dale R.", or null when the poster's profile has no name. */
  poster: string | null;
  /** The signed-in sender's address, which the poster will see. */
  senderEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // React empties the form after each submission, back to the field's default: the message again
  // after a problem, nothing once it's sent.
  const value = state.status === "error" ? state.value : "";
  // The message goes on the field, as an alert so screen readers read it out. It's hidden while the
  // form sends again, so a repeated message is a new alert, read out again.
  const fieldError =
    !pending && state.status === "error" && state.field === "message" ? (
      <span role="alert">{state.message}</span>
    ) : undefined;
  const address = senderEmail ? `your email address, ${senderEmail}` : "your email address";

  return (
    <form action={formAction} noValidate className="mt-3">
      <TextareaField
        name="message"
        label={`Your message to ${poster ?? "the poster"}`}
        hint={`We'll email it to them with your name and ${address}, so they can reply to you. Their address stays private.`}
        rows={6}
        required
        defaultValue={value}
        error={fieldError}
      />
      <Button type="submit" variant="dark" pending={pending} className="mt-3 w-full">
        {pending ? "Sending…" : "Send message"}
      </Button>
      {!pending && state.status === "error" && state.field === null && (
        <FormError className="mt-2">{state.message}</FormError>
      )}
      {/* Always in the page, so screen readers announce the message when it appears. Emptied while
          the form sends again, so the same message is announced again. */}
      <div role="status" className="mt-3">
        {!pending && state.status === "sent" && <SuccessBox>{state.message}</SuccessBox>}
      </div>
    </form>
  );
}
