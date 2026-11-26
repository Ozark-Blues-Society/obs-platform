// Form state for giving and removing staff roles (backlog A-2), and the wording administrators see
// for each outcome. Kept free of server code so the forms and the unit tests can import it.

import { ROLE_LABELS, isRole, type Role } from "@/lib/auth/roles";

/** Someone with at least one staff role, as the roles screen lists them. */
export type StaffMember = { id: string; name: string; email: string; roles: Role[] };

export type GrantRoleField = "email" | "role";

export type GrantRoleState =
  | { status: "idle" }
  | { status: "granted"; message: string }
  // `field` is null for a problem that isn't about one field. `email` and `role` keep what was sent.
  | { status: "error"; field: GrantRoleField | null; message: string; email: string; role: string };

export type RevokeRoleState =
  | { status: "idle" }
  | { status: "revoked"; message: string }
  | { status: "error"; message: string };

export const ROLE_MESSAGES = {
  emailHint: "The address they use to sign in to the website.",
  emailMissing: "Enter the email address of their account.",
  emailInvalid: "Enter an email address like name@example.com.",
  roleMissing: "Choose a role.",
  noAccount:
    "No account uses that email address. Check the spelling. Someone needs an account on the " +
    "website, the kind members have, before they can have a role.",
  notAdmin: "Only administrators can give and remove roles.",
  lastAdmin:
    "You can't remove the last administrator. Give someone else the Administrator role first.",
  alreadyRemoved: "That role was already removed.",
  unavailable: "Roles can't be changed right now. Please try again in a few minutes.",
} as const;

/**
 * The error code (SQLSTATE) the database gives when a change would leave no administrator: see
 * supabase/migrations/20261126071148_roles_management.sql.
 */
export const LAST_ADMIN_ERROR = "OB001";

/** The part of a Postgres error, as Supabase's Data API reports it, that the forms care about. */
export type DatabaseErrorLike = { code?: string; message?: string };

export function grantedMessage(name: string, role: Role): string {
  return `${name} now has the ${ROLE_LABELS[role]} role.`;
}

export function revokedMessage(name: string, role: Role): string {
  return `${name} no longer has the ${ROLE_LABELS[role]} role.`;
}

/** What to tell an administrator when the database refuses to give `name` the role. */
export function grantProblem(error: DatabaseErrorLike, name: string, role: Role): string {
  switch (error.code) {
    case "23505": // unique_violation
      return `${name} already has the ${ROLE_LABELS[role]} role.`;
    case "23503": // foreign_key_violation: the account was deleted in the meantime
      return ROLE_MESSAGES.noAccount;
    case "42501": // insufficient_privilege: row level security
      return ROLE_MESSAGES.notAdmin;
    default:
      return ROLE_MESSAGES.unavailable;
  }
}

/** What to tell an administrator when the database refuses to remove a role. */
export function revokeProblem(error: DatabaseErrorLike): string {
  switch (error.code) {
    case LAST_ADMIN_ERROR:
      return ROLE_MESSAGES.lastAdmin;
    case "42501":
      return ROLE_MESSAGES.notAdmin;
    default:
      return ROLE_MESSAGES.unavailable;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The value of the Remove button for one person's role: what revokeRole() receives. */
export function removalValue(profileId: string, role: Role): string {
  return `${profileId}:${role}`;
}

/** Reads a Remove button's value back. Null for anything removalValue() doesn't produce. */
export function parseRemoval(
  value: FormDataEntryValue | null,
): { profileId: string; role: Role } | null {
  if (typeof value !== "string") {
    return null;
  }
  const [profileId, role, ...rest] = value.split(":");
  return rest.length === 0 && UUID.test(profileId) && isRole(role) ? { profileId, role } : null;
}

type NamedProfile = { first_name: string | null; last_name: string | null; email: string };

/** A member's name for the roles screen: first and last name, or the address if they gave none. */
export function personName(profile: NamedProfile): string {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.email;
}
