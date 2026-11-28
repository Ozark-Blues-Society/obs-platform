"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, SuccessBox, TextareaField, TextField } from "@/components/ui/form-fields";
import {
  TRAP_FIELD,
  type ContactDefaults,
  type ContactField,
  type ContactState,
  type ContactValues,
} from "@/lib/listings/public-state";

// The Server Function arrives as a prop (from the listing's page), so the form can be tested on its
// own.
type ContactAction = (state: ContactState, formData: FormData) => Promise<ContactState>;

/**
 * Writes to a listing's poster through the site (backlog K-3, decision 0009): anyone gives a name,
 * an email address and a message. The site emails the message on, so the poster can reply, without
 * showing the poster's address. A signed-in member's own name and address are filled in.
 */
export function ContactForm({
  action,
  poster,
  defaults,
}: {
  action: ContactAction;
  /** "Dale R.", or null when the poster's profile has no name. */
  poster: string | null;
  defaults: ContactDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // React empties the form after each submission, back to each field's default: what was typed
  // after a problem, the starting values once the message has gone.
  const values: ContactValues =
    state.status === "error" ? state.values : { ...defaults, message: "" };
  // The message goes on the field it's about, as an alert so screen readers read it out. It's
  // hidden while the form sends again, so a repeated message is a new alert, read out again.
  const errorOn = (field: ContactField) =>
    !pending && state.status === "error" && state.field === field ? (
      <span role="alert">{state.message}</span>
    ) : undefined;
  const who = poster ?? "the poster";

  return (
    <form action={formAction} noValidate className="relative mt-3">
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        defaultValue={values.name}
        error={errorOn("name")}
      />
      <TextField
        label="Your email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint={`${poster ?? "The poster"} replies to this address.`}
        defaultValue={values.email}
        error={errorOn("email")}
        className="mt-4"
      />
      <TextareaField
        label={`Your message to ${who}`}
        name="message"
        hint="We email it to them with your name and address. Their own address stays private."
        rows={6}
        required
        defaultValue={values.message}
        error={errorOn("message")}
        className="mt-4"
      />
      {/* A field people never see or reach, which scripts fill in (decision 0009). */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Leave this empty
          <input type="text" name={TRAP_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
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
