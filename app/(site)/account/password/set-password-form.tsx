"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { SuccessBox, TextField } from "@/components/ui/form-fields";
import {
  PASSWORD_MESSAGES,
  type PasswordField,
  type SetPasswordState,
} from "@/lib/auth/password-state";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type SetPasswordAction = (state: SetPasswordState, formData: FormData) => Promise<SetPasswordState>;

export function SetPasswordForm({ action, email }: { action: SetPasswordAction; email: string }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // The message goes on the field it's about, as an alert so screen readers read it out. It's
  // hidden while the form sends again, so a repeated message is a new alert, read out again.
  const errorOn = (field: PasswordField) =>
    !pending && state.status === "error" && state.field === field ? (
      <span role="alert">{state.message}</span>
    ) : undefined;

  return (
    <form action={formAction} noValidate className="mt-8">
      {/* Tells password managers which account the new password belongs to. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={PASSWORD_MESSAGES.hint}
        error={errorOn("password")}
      />
      <TextField
        label="Type the new password again"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errorOn("confirm")}
        className="mt-4"
      />
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
        {pending ? "Saving…" : "Save password"}
      </Button>
      {/* Always in the page, so screen readers announce the message when it appears. Emptied
          while the form sends again, so the same message is announced again. */}
      <div role="status" className="mt-4">
        {!pending && state.status === "saved" && (
          <SuccessBox>
            <p className="font-semibold">Your new password is saved.</p>
            <p className="mt-1">
              Next time, sign in with your email address and this password, or with an email link as
              before.
            </p>
          </SuccessBox>
        )}
      </div>
    </form>
  );
}
