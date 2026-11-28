"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, SuccessBox } from "@/components/ui/form-fields";
import { SIGNUP_MESSAGES, TRAP_FIELD, type SignupState } from "@/lib/newsletter/signup-state";

// The Server Function arrives as a prop (from the blog page), so the form can be tested on its own.
type SignUpAction = (state: SignupState, formData: FormData) => Promise<SignupState>;

/**
 * "Get the blog in your inbox", at the end of the blog as in the approved concept (decision 0015):
 * an address and a Subscribe button. The blog page shows it only while MailerLite is connected.
 */
export function NewsletterSignup({ action }: { action: SignUpAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const id = useId();
  const errorId = `${id}-error`;
  // Hidden while the form sends again, so a repeated message is a new alert, read out again.
  const error = !pending && state.status === "error" ? state : null;
  const fieldError = error?.field === "email" ? error.message : null;

  return (
    <Card
      as="section"
      aria-labelledby={`${id}-heading`}
      className="mt-7 flex flex-wrap items-center justify-between gap-4 p-6"
    >
      <div className="min-w-0 md:max-w-md">
        <h2 id={`${id}-heading`} className="text-h3">
          Get the blog in your inbox
        </h2>
        <p className="mt-1 text-muted">
          A monthly digest of new posts and upcoming shows. Members get it automatically.
        </p>
      </div>
      <form action={formAction} noValidate className="w-full md:w-auto">
        <label htmlFor={`${id}-email`} className="block text-small font-semibold text-ink">
          Email address
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            // React resets the form after each submission: back to what was sent, after a problem.
            defaultValue={state.status === "error" ? state.email : ""}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            className="min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted aria-invalid:border-danger md:w-60 md:flex-none"
          />
          <Button type="submit" variant="dark" pending={pending}>
            {pending ? "Subscribing…" : "Subscribe"}
          </Button>
        </div>
        {/* For form-filling bots: out of sight, out of the tab order and hidden from screen
            readers. */}
        <div hidden>
          <label htmlFor={`${id}-${TRAP_FIELD}`}>Leave this empty</label>
          <input
            id={`${id}-${TRAP_FIELD}`}
            name={TRAP_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        {fieldError && (
          <p id={errorId} role="alert" className="mt-1 text-small font-medium text-danger">
            {fieldError}
          </p>
        )}
        {error?.field === null && <FormError className="mt-2">{error.message}</FormError>}
        {/* Always in the page, so screen readers announce the message when it appears. */}
        <div role="status" className="mt-3 empty:mt-0 md:max-w-sm">
          {!pending && state.status === "done" && <SuccessBox>{SIGNUP_MESSAGES.done}</SuccessBox>}
        </div>
      </form>
    </Card>
  );
}
