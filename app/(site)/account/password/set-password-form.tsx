"use client";

import { useActionState, useId } from "react";
import {
  buttonClass,
  errorClass,
  inputClass,
  labelClass,
  successBoxClass,
} from "@/components/form-classes";
import {
  PASSWORD_MESSAGES,
  type PasswordField,
  type SetPasswordState,
} from "@/lib/auth/password-state";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type SetPasswordAction = (state: SetPasswordState, formData: FormData) => Promise<SetPasswordState>;

export function SetPasswordForm({ action, email }: { action: SetPasswordAction; email: string }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const id = useId();
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const errorOn = (field: PasswordField) => state.status === "error" && state.field === field;
  const error = state.status === "error" && (
    <p id={errorId} role="alert" className={errorClass}>
      {state.message}
    </p>
  );

  return (
    <form action={formAction} noValidate className="mt-8">
      {/* Tells password managers which account the new password belongs to. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <label htmlFor={passwordId} className={labelClass}>
        New password
      </label>
      <p id={hintId} className="mt-1 text-sm text-muted">
        {PASSWORD_MESSAGES.hint}
      </p>
      <input
        id={passwordId}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        aria-invalid={errorOn("password") || undefined}
        aria-describedby={errorOn("password") ? `${hintId} ${errorId}` : hintId}
        className={inputClass}
      />
      {errorOn("password") && error}
      <label htmlFor={confirmId} className={`${labelClass} mt-4`}>
        Type the new password again
      </label>
      <input
        id={confirmId}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        aria-invalid={errorOn("confirm") || undefined}
        aria-describedby={errorOn("confirm") ? errorId : undefined}
        className={inputClass}
      />
      {errorOn("confirm") && error}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save password"}
      </button>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status" className="mt-4">
        {state.status === "saved" && (
          <div className={successBoxClass}>
            <p className="font-semibold">Your new password is saved.</p>
            <p className="mt-1">
              Next time, sign in with your email address and this password, or with an email link as
              before.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
