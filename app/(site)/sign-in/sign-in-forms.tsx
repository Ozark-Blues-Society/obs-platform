"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { SuccessBox, TextField } from "@/components/ui/form-fields";
import type { EmailLinkState, PasswordState } from "@/lib/auth/sign-in-state";

// The Server Functions arrive as props (from page.tsx), so the forms can be tested on their own.
type EmailLinkAction = (state: EmailLinkState, formData: FormData) => Promise<EmailLinkState>;
type PasswordAction = (state: PasswordState, formData: FormData) => Promise<PasswordState>;

export function EmailLinkForm({ action }: { action: EmailLinkAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} noValidate className="mt-4">
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        spellCheck={false}
        required
        defaultValue={state.status === "idle" ? "" : state.email}
        // An alert, so screen readers read the message out when it appears. Hidden while the form
        // sends again, so the next message is a new alert, read out even if it's the same.
        error={!pending && state.status === "error" && <span role="alert">{state.message}</span>}
      />
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {/* Always in the page, so screen readers announce the message when it appears. Emptied
          while the form sends again, so the same message is announced again. */}
      <div role="status" className="mt-4">
        {!pending && state.status === "sent" && (
          <SuccessBox>
            <p className="font-semibold">Check your email.</p>
            <p className="mt-1">
              If <strong>{state.email}</strong> belongs to a member, a sign-in link is on its way.
              It can take a minute to arrive, so check your spam folder too. The link works once,
              for one hour.
            </p>
          </SuccessBox>
        )}
      </div>
    </form>
  );
}

export function PasswordForm({ action, next }: { action: PasswordAction; next: string }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const hasError = state.status === "error";

  return (
    <form action={formAction} noValidate className="mt-4">
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="username"
        spellCheck={false}
        required
        defaultValue={hasError ? state.email : ""}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        // Hidden while the form sends again, so a repeated message is a new alert, read out again.
        error={!pending && hasError && <span role="alert">{state.message}</span>}
        className="mt-4"
      />
      <Button type="submit" variant="dark" pending={pending} className="mt-4 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
