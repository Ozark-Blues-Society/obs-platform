// Where the app finds Supabase. Locally that's the local stack (values in .env.example); CI reads
// them from `supabase status`. F-4 replaces this with typed, validated config for every variable.

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

/** The Supabase URL and publishable key, or null when they aren't set. */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return null;
  }
  return { url, publishableKey };
}

/** The Supabase URL and publishable key. Throws when they aren't set. */
export function getSupabaseConfig(): SupabaseConfig {
  const config = readSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (for local development, copy .env.example to .env.local).",
    );
  }
  return config;
}
