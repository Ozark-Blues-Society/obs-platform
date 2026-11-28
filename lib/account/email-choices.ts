import "server-only";
import type { CurrentUser } from "@/lib/auth/user";
import type { MemberAddress } from "@/lib/mailerlite/topics";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who the signed-in member is to MailerLite, for the email switches on My Account (decision 0016):
 * the address they sign in with, and their subscriber's id if the member group sync recorded one
 * (mailerlite_subscribers, which only the service role reads; the session decided whose row). The
 * id finds them even after they changed their address in MailerLite. Without it, as when the
 * database can't be read, they're found by address. Null without an address.
 */
export async function memberAddress(user: CurrentUser): Promise<MemberAddress | null> {
  if (!user.email) return null;
  let subscriberId: string | null = null;
  try {
    const { data, error } = await createAdminClient()
      .from("mailerlite_subscribers")
      .select("subscriber_id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    const id = (data as { subscriber_id?: unknown } | null)?.subscriber_id;
    if (typeof id === "string") subscriberId = id;
  } catch (error) {
    console.error(
      "Reading a member's MailerLite subscriber id failed; finding them by address:",
      error instanceof Error ? error.message : String(error),
    );
  }
  return { email: user.email, subscriberId };
}
