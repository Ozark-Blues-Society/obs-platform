import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
