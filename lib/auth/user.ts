import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, type Role } from "./roles";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * The signed-in member, or null for a visitor. It verifies the session token rather than trusting
 * the cookie. It reads the request, so under Cache Components call it inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) {
    return null;
  }
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}

/**
 * The signed-in member. A visitor is sent to the sign-in page, which brings them back to
 * `returnTo` afterwards.
 */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

/**
 * The staff roles of the signed-in member `userId` (user_roles): none for most members. Throws if
 * they can't be read. A UI check only: row level security enforces roles in the database.
 */
export async function getRoles(userId: string): Promise<Role[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_roles").select("role").eq("profile_id", userId);
  if (error) {
    throw new Error(`Reading the member's roles failed: ${error.code} ${error.message}`);
  }
  const held = new Set((data ?? []).map((row: { role: unknown }) => row.role));
  return ROLES.filter((role) => held.has(role));
}
