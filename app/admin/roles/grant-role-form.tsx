"use client";

import { useActionState, useId } from "react";
import {
  buttonClass,
  errorClass,
  inputClass,
  labelClass,
  successBoxClass,
} from "@/components/form-classes";
import { ROLE_MESSAGES, type GrantRoleField, type GrantRoleState } from "@/lib/admin/roles-state";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type GrantRoleAction = (state: GrantRoleState, formData: FormData) => Promise<GrantRoleState>;

export function GrantRoleForm({ action }: { action: GrantRoleAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const id = useId();
  const emailId = `${id}-email`;
  const hintId = `${id}-hint`;
  const roleId = `${id}-role`;
  const errorId = `${id}-error`;
  const errorOn = (field: GrantRoleField | null) =>
    state.status === "error" && state.field === field;
  const error = state.status === "error" && (
    <p id={errorId} role="alert" className={errorClass}>
      {state.message}
    </p>
  );

  return (
    <form action={formAction} noValidate className="mt-6 max-w-md">
      <label htmlFor={emailId} className={labelClass}>
        Email address
      </label>
      <p id={hintId} className="mt-1 text-sm text-muted">
        {ROLE_MESSAGES.emailHint}
      </p>
      <input
        id={emailId}
        name="email"
        type="email"
        autoComplete="off"
        spellCheck={false}
        required
        defaultValue={state.status === "error" ? state.email : ""}
        aria-invalid={errorOn("email") || undefined}
        aria-describedby={errorOn("email") ? `${hintId} ${errorId}` : hintId}
        className={inputClass}
      />
      {errorOn("email") && error}
      <label htmlFor={roleId} className={`${labelClass} mt-4`}>
        Role
      </label>
      {/* React resets the form after each submission, back to each field's default. A select's
          default is set only when it mounts, so the key mounts it afresh with the role sent. */}
      <select
        key={state.status === "error" ? state.role : ""}
        id={roleId}
        name="role"
        required
        defaultValue={state.status === "error" ? state.role : ""}
        aria-invalid={errorOn("role") || undefined}
        aria-describedby={errorOn("role") ? errorId : undefined}
        className={inputClass}
      >
        <option value="">Choose a role</option>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {errorOn("role") && error}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Giving the role…" : "Give role"}
      </button>
      {errorOn(null) && error}
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status" className="mt-4">
        {state.status === "granted" && <p className={successBoxClass}>{state.message}</p>}
      </div>
    </form>
  );
}
