"use client";

import { useActionState } from "react";
import { errorClass, successBoxClass } from "@/components/form-classes";
import { removalValue, type RevokeRoleState, type StaffMember } from "@/lib/admin/roles-state";
import { ROLE_LABELS } from "@/lib/auth/roles";

type RevokeRoleAction = (state: RevokeRoleState, formData: FormData) => Promise<RevokeRoleState>;

/**
 * The people with roles, each role with a Remove button. One form holds every button, so the
 * outcome stays on screen after the list refreshes, even when that person has left it.
 */
export function StaffList({
  staff,
  currentUserId,
  action,
}: {
  staff: StaffMember[];
  currentUserId: string;
  action: RevokeRoleAction;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="mt-4">
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {state.status === "revoked" && <p className={`${successBoxClass} mb-4`}>{state.message}</p>}
      </div>
      {state.status === "error" && (
        <p role="alert" className={`${errorClass} mb-4`}>
          {state.message}
        </p>
      )}
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {staff.map((person) => {
          const isYou = person.id === currentUserId;
          return (
            <li key={person.id} className="px-4 py-3">
              <p className="font-semibold">
                {person.name}
                {isYou && <span className="font-normal text-muted"> (you)</span>}
              </p>
              <p className="text-sm break-all text-muted">{person.email}</p>
              <ul aria-label={`Roles of ${person.name}`} className="mt-2 flex flex-col gap-2">
                {person.roles.map((role) => (
                  <li key={role} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="rounded-sm bg-primary-soft px-2 py-0.5 text-tag text-primary uppercase">
                      {ROLE_LABELS[role]}
                    </span>
                    <button
                      type="submit"
                      name="remove"
                      value={removalValue(person.id, role)}
                      disabled={pending}
                      aria-label={
                        isYou
                          ? `Remove your ${ROLE_LABELS[role]} role`
                          : `Remove the ${ROLE_LABELS[role]} role from ${person.name}`
                      }
                      className="text-sm font-semibold text-primary-light underline hover:text-primary disabled:cursor-wait"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
