import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the service role, for server code that acts for the Society rather than
 * for a signed-in member: the daily jobs (lib/jobs/daily.ts), and later the Stripe webhook and
 * the importer. It bypasses row level security, so never use it for a member's own request, and
 * never let its key reach the browser: SUPABASE_SECRET_KEY has no NEXT_PUBLIC_ name.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "The service role isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY " +
        "(locally: the SECRET_KEY that `supabase status` prints).",
    );
  }
  return createClient(url, secretKey, {
    // No member session: don't store, refresh or look for one.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
