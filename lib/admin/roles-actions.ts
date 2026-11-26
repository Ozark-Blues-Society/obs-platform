"use server";

import { refresh } from "next/cache";
import { isRole } from "@/lib/auth/roles";
import { looksLikeEmail, normalizeEmail } from "@/lib/auth/sign-in-state";
import { getRoles, requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_MESSAGES,
  grantProblem,
  grantedMessage,
  parseRemoval,
  personName,
  revokeProblem,
  revokedMessage,
  type GrantRoleField,
  type GrantRoleState,
  type RevokeRoleState,
} from "./roles-state";

// The roles screen's Server Functions (app/admin/roles). Anyone can call a Server Function, so each
// checks the session and the Administrator role itself, not only the page. Row level security
// enforces the same rule in the database, which also refuses to remove the last administrator
// (supabase/migrations/20261126071148_roles_management.sql).

const ROLES_PAGE = "/admin/roles";

type RemovedRole = {
  profiles: { first_name: string | null; last_name: string | null; email: string } | null;
};

async function isAdmin(userId: string): Promise<boolean> {
  return (await getRoles(userId)).includes("admin");
}

/** Gives the role chosen in the form to the account whose email address was typed in it. */
export async function grantRole(
  _previous: GrantRoleState,
  formData: FormData,
): Promise<GrantRoleState> {
  const user = await requireUser(ROLES_PAGE);

  const email = normalizeEmail(formData.get("email"));
  const sentRole = formData.get("role");
  const role = typeof sentRole === "string" ? sentRole : "";
  const problem = (field: GrantRoleField | null, message: string): GrantRoleState => ({
    status: "error",
    field,
    message,
    email,
    role,
  });

  if (!email) {
    return problem("email", ROLE_MESSAGES.emailMissing);
  }
  if (!looksLikeEmail(email)) {
    return problem("email", ROLE_MESSAGES.emailInvalid);
  }
  if (!isRole(role)) {
    return problem("role", ROLE_MESSAGES.roleMissing);
  }

  try {
    if (!(await isAdmin(user.id))) {
      return problem(null, ROLE_MESSAGES.notAdmin);
    }

    const supabase = await createClient();
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) {
      console.error(
        "Finding the account for a role failed:",
        lookupError.code,
        lookupError.message,
      );
      return problem(null, ROLE_MESSAGES.unavailable);
    }
    if (!profile) {
      return problem("email", ROLE_MESSAGES.noAccount);
    }

    const name = personName(profile);
    const { error } = await supabase.from("user_roles").insert({ profile_id: profile.id, role });
    // The list of people with roles may be out of date whatever happened, so show it afresh.
    refresh();
    if (error) {
      const message = grantProblem(error, name, role);
      if (message === ROLE_MESSAGES.unavailable) {
        console.error("Giving a role failed:", error.code, error.message);
      }
      return problem(null, message);
    }
    return { status: "granted", message: grantedMessage(name, role) };
  } catch (cause) {
    console.error("Giving a role failed:", cause);
    return problem(null, ROLE_MESSAGES.unavailable);
  }
}

/** Removes one role from one person: the Remove button that was pressed says which. */
export async function revokeRole(
  _previous: RevokeRoleState,
  formData: FormData,
): Promise<RevokeRoleState> {
  const user = await requireUser(ROLES_PAGE);

  const removal = parseRemoval(formData.get("remove"));
  if (!removal) {
    // The page never sends this, so someone made the request up.
    return { status: "error", message: ROLE_MESSAGES.unavailable };
  }

  try {
    if (!(await isAdmin(user.id))) {
      return { status: "error", message: ROLE_MESSAGES.notAdmin };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_roles")
      .delete()
      .eq("profile_id", removal.profileId)
      .eq("role", removal.role)
      .select("profiles(first_name, last_name, email)");
    refresh();
    if (error) {
      const message = revokeProblem(error);
      if (message === ROLE_MESSAGES.unavailable) {
        console.error("Removing a role failed:", error.code, error.message);
      }
      return { status: "error", message };
    }
    // Each role belongs to one profile, so PostgREST embeds an object. Without generated database
    // types, supabase-js can't know that and types it as a list.
    const removed = (data as unknown as RemovedRole[] | null)?.[0]?.profiles;
    if (!removed) {
      return { status: "error", message: ROLE_MESSAGES.alreadyRemoved };
    }
    return { status: "revoked", message: revokedMessage(personName(removed), removal.role) };
  } catch (cause) {
    console.error("Removing a role failed:", cause);
    return { status: "error", message: ROLE_MESSAGES.unavailable };
  }
}
