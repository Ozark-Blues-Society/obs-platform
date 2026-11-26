"use client";

import { useActionState, useId } from "react";
import type { EmailLinkState, PasswordState } from "@/lib/auth/sign-in-state";

// The Server Functions arrive as props (from page.tsx), so the forms can be tested on their own.
type EmailLinkAction = (state: EmailLinkState, formData: FormData) => Promise<EmailLinkState>;
type PasswordAction = (state: PasswordState, formData: FormData) => Promise<PasswordState>;

const labelClass = "block text-sm font-semibold text-neutral-900";
const inputClass =
  "mt-1 block w-full rounded-lg border border-neutral-500 bg-white px-3 py-2 text-base text-neutral-900 " +
  "focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none " +
  "aria-[invalid=true]:border-red-700";
const buttonClass =
  "mt-4 inline-flex w-full items-center justify-center rounded-full bg-neutral-900 px-5 py-2.5 " +
  "font-semibold text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-70";
const errorClass = "mt-2 text-sm font-medium text-red-700";

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
          <div className="rounded-lg border border-green-700 bg-green-50 p-4 text-sm text-green-900">
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
