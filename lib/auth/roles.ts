// Staff roles (user_roles in docs/spec/architecture.md; backlog A-2). Kept free of server code so
// pages, forms and tests can import it.

/** The staff roles, in the order the roles screen lists them: the database's app_role values. */
export const ROLES = ["admin", "membership_manager", "moderator", "editor"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  membership_manager: "Membership Manager",
  moderator: "Moderator",
  editor: "Editor",
};

/** What each role is for, as the roles screen and the volunteer guide (roles.md) describe it. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Gives and removes roles, this one included.",
  membership_manager:
    "Looks after member records: the member list, exports, and check or cash payments.",
  moderator: "Reviews classified listings before they go live.",
  editor:
    "Edits the website's content. Their Content Studio sign-in is set up separately, in Sanity.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
