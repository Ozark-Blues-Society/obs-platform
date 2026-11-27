// The public environment variables (NEXT_PUBLIC_), checked by lib/env/schema.ts. Safe to import
// anywhere, browser code included: every visitor's browser gets these values, so none of them may
// be a secret.
//
// Next.js writes a public variable's value into the code it builds only where
// `process.env.NEXT_PUBLIC_...` is written out in full, so each one is listed by name below. A new
// public variable goes in PUBLIC_VARS (schema.ts), in this list and in .env.example.
import { parsePublicEnv, type PublicEnv, type PublicKey } from "./schema.ts";

/** The given public variables (all of them when none is named), checked. Throws an EnvError. */
export function publicEnv<K extends PublicKey = PublicKey>(...keys: K[]): Pick<PublicEnv, K> {
  return parsePublicEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
      NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    },
    keys,
  );
}
