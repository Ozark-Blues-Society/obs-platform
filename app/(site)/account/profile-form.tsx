"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, SuccessBox, TextField } from "@/components/ui/form-fields";
import {
  PROFILE_MESSAGES,
  type ProfileField,
  type ProfileState,
  type ProfileValues,
} from "@/lib/account/profile-state";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type SaveProfileAction = (state: ProfileState, formData: FormData) => Promise<ProfileState>;

/** The member's name and phone on My Account (backlog M-8). */
export function ProfileForm({
  action,
  profile,
}: {
  action: SaveProfileAction;
  /** The details as saved. */
  profile: ProfileValues;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // React resets the form after each submission, back to each field's default: what was sent, after
  // a problem, or what was saved.
  const values = state.status === "idle" ? profile : state.values;
  // The message goes on the field it's about, as an alert so screen readers read it out. It's hidden
  // while the form sends again, so a repeated message is a new alert, read out again.
  const errorOn = (field: ProfileField) =>
    !pending && state.status === "error" && state.field === field ? (
      <span role="alert">{state.message}</span>
    ) : undefined;

  return (
    <form action={formAction} noValidate className="mt-4">
      <TextField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        required
        defaultValue={values.firstName}
        error={errorOn("firstName")}
      />
      <TextField
        label="Last name (optional)"
        name="lastName"
        autoComplete="family-name"
        defaultValue={values.lastName}
        error={errorOn("lastName")}
        className="mt-4"
      />
      <TextField
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        hint={PROFILE_MESSAGES.phoneHint}
        defaultValue={values.phone}
        error={errorOn("phone")}
        className="mt-4"
      />
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
        {pending ? "Saving…" : "Save details"}
      </Button>
      {!pending && state.status === "error" && state.field === null && (
        <FormError className="mt-2">{state.message}</FormError>
      )}
      {/* Always in the page, so screen readers announce the message when it appears. Emptied while
          the form sends again, so the same message is announced again. */}
      <div role="status" className="mt-4">
        {!pending && state.status === "saved" && <SuccessBox>{PROFILE_MESSAGES.saved}</SuccessBox>}
      </div>
    </form>
  );
}
