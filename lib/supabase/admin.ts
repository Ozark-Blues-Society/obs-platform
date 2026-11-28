import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";
import { requireEnv } from "@/lib/env/schema";
import { serverEnv } from "@/lib/env/server";

/**
 * A Supabase client with the service role, for server code that acts for the Society rather than
 * for a signed-in member: the daily jobs (lib/jobs/daily.ts), the MailerLite sync after a change
 * (lib/mailerlite/on-change.ts), the classifieds' poster names and emails (lib/listings/), and
 * later the payment webhook and the importer. It bypasses row level security, so use it in
 * someone's request only after that request's own checks (the session, the role), never instead
 * of them, and never let its key reach the browser: SUPABASE_SECRET_KEY is a server-only variable
 * (lib/env).
 */
export function createAdminClient() {
  const url = requireEnv(
    publicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
    "the service role needs Supabase's address (locally, copy .env.example to .env.local).",
  );
  const secretKey = requireEnv(
    serverEnv("SUPABASE_SECRET_KEY"),
    "SUPABASE_SECRET_KEY",
    "the service role needs it (locally, the SECRET_KEY that `supabase status` prints).",
  );
  return createClient(url, secretKey, {
    // No member session: don't store, refresh or look for one.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
