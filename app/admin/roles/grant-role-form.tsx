"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, SelectField, SuccessBox, TextField } from "@/components/ui/form-fields";
import { ROLE_MESSAGES, type GrantRoleField, type GrantRoleState } from "@/lib/admin/roles-state";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";

// The Server Function arrives as a prop (from page.tsx), so the form can be tested on its own.
type GrantRoleAction = (state: GrantRoleState, formData: FormData) => Promise<GrantRoleState>;

export function GrantRoleForm({ action }: { action: GrantRoleAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const message = state.status === "error" ? state.message : undefined;
  const errorOn = (field: GrantRoleField | null) =>
    state.status === "error" && state.field === field;
  // A field's message, as an alert so screen readers read it out.
  const fieldError = <span role="alert">{message}</span>;

  return (
    <form action={formAction} noValidate className="mt-6 max-w-md">
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="off"
        spellCheck={false}
        required
        hint={ROLE_MESSAGES.emailHint}
        defaultValue={state.status === "error" ? state.email : ""}
        error={errorOn("email") && fieldError}
      />
      {/* React resets the form after each submission, back to each field's default. A select's
          default is set only when it mounts, so the key mounts it afresh with the role sent. */}
      <SelectField
        key={state.status === "error" ? state.role : ""}
        label="Role"
        name="role"
        required
        defaultValue={state.status === "error" ? state.role : ""}
        error={errorOn("role") && fieldError}
        className="mt-4"
      >
        <option value="">Choose a role</option>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="dark" disabled={pending} className="mt-4 w-full">
        {pending ? "Giving the role…" : "Give role"}
      </Button>
      {errorOn(null) && <FormError className="mt-2">{message}</FormError>}
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status" className="mt-4">
        {state.status === "granted" && <SuccessBox>{state.message}</SuccessBox>}
      </div>
    </form>
  );
}
