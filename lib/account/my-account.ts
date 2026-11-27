import "server-only";
import { requireUser } from "@/lib/auth/user";
import { isMembershipLevel } from "@/lib/members/access";
import type { MembershipFacts } from "@/lib/members/membership";
import { ACCOUNT_PATH } from "@/lib/site/navigation";
import { createClient } from "@/lib/supabase/server";

/** What My Account shows from the signed-in member's own profile row (backlog M-8). */
export type MyAccount = MembershipFacts & {
  /** The address they sign in with (profiles.email follows Supabase Auth). */
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  /** profiles.joined_at: when the membership started. Null until the first payment. */
  joinedAt: string | null;
};

// Everything the page shows, and nothing else: not the staff notes, which members may read but My
// Account doesn't show, nor the Stripe customer.
const COLUMNS = "email, first_name, last_name, phone, level, expires_at, auto_renew, joined_at";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/**
 * The signed-in member's own profile: the session decides whose, so no caller can ask for anyone
 * else's. A visitor is sent to sign in. It reads the session, so call it inside a <Suspense>
 * boundary. Throws if the profile can't be read.
 */
export async function getMyAccount(): Promise<MyAccount> {
  const user = await requireUser(ACCOUNT_PATH);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    throw new Error(`Reading the member's profile failed: ${error.code} ${error.message}`);
  }
  // Signing up makes the profile (a trigger on auth.users), so a missing one means nothing has
  // been recorded for them yet: no membership.
  const profile = (data ?? {}) as Record<string, unknown>;
  return {
    email: text(profile.email) ?? user.email ?? "",
    firstName: text(profile.first_name),
    lastName: text(profile.last_name),
    phone: text(profile.phone),
    level: isMembershipLevel(profile.level) ? profile.level : null,
    expiresAt: text(profile.expires_at),
    autoRenew: profile.auto_renew === true,
    joinedAt: text(profile.joined_at),
  };
}
