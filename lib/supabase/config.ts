// Where the app finds Supabase: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (lib/env). Locally that's the local stack (values in .env.example); CI reads them from there too.
import { publicEnv } from "@/lib/env/public";
import { EnvError } from "@/lib/env/schema";

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

/**
 * The Supabase URL and publishable key, or null when neither is set: the public pages work without
 * Supabase. Throws an EnvError when one is set without the other, or is invalid.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const env = publicEnv("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // publicEnv() refuses one without the other.
  return url && publishableKey ? { url, publishableKey } : null;
}

/** The Supabase URL and publishable key. Throws an EnvError naming them when they aren't set. */
export function getSupabaseConfig(): SupabaseConfig {
  const config = readSupabaseConfig();
  if (!config) {
    throw new EnvError([
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        message:
          "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and " +
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (for local development, copy .env.example to " +
          ".env.local).",
      },
    ]);
  }
  return config;
}
