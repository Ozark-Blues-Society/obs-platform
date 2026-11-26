"use client";

import { useActionState, useId } from "react";
import {
  buttonClass,
  errorClass,
  inputClass,
  labelClass,
  successBoxClass,
} from "@/components/form-classes";
import type { EmailLinkState, PasswordState } from "@/lib/auth/sign-in-state";

// The Server Functions arrive as props (from page.tsx), so the forms can be tested on their own.
type EmailLinkAction = (state: EmailLinkState, formData: FormData) => Promise<EmailLinkState>;
type PasswordAction = (state: PasswordState, formData: FormData) => Promise<PasswordState>;

export function EmailLinkForm({ action }: { action: EmailLinkAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const id = useId();
  const emailId = `${id}-email`;
  const errorId = `${id}-error`;
  const hasError = state.status === "error";

  return (
    <form action={formAction} noValidate className="mt-4">
      <label htmlFor={emailId} className={labelClass}>
        Email address
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        autoComplete="email"
        spellCheck={false}
        required
        defaultValue={state.status === "idle" ? "" : state.email}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={inputClass}
      />
      {hasError && (
        <p id={errorId} role="alert" className={errorClass}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status" className="mt-4">
        {state.status === "sent" && (
          <div className={successBoxClass}>
            <p className="font-semibold">Check your email.</p>
            <p className="mt-1">
              If <strong>{state.email}</strong> belongs to a member, a sign-in link is on its way.
              It can take a minute to arrive, so check your spam folder too. The link works once,
              for one hour.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}

export function PasswordForm({ action, next }: { action: PasswordAction; next: string }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const errorId = `${id}-error`;
  const hasError = state.status === "error";

  return (
    <form action={formAction} noValidate className="mt-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor={emailId} className={labelClass}>
        Email address
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        autoComplete="username"
        spellCheck={false}
        required
        defaultValue={hasError ? state.email : ""}
        className={inputClass}
      />
      <label htmlFor={passwordId} className={`${labelClass} mt-4`}>
        Password
      </label>
      <input
        id={passwordId}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={inputClass}
      />
      {hasError && (
        <p id={errorId} role="alert" className={errorClass}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
