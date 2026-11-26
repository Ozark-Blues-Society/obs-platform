import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseConfig } from "./config";

/**
 * A Supabase client for Server Components, Server Functions and Route Handlers. It acts as the
 * person making the request: the signed-in member, or an anonymous visitor. Create one per request
 * and never share it between requests.
 */
export async function createClient() {
  // Wait for a real request before anything else. Checking a session reads the clock (is the token
  // still valid?), and under Cache Components a prerender, even one for prefetching that can read
  // cookies, must not. It also means the config check below never runs at build time.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies; only Server Functions and Route Handlers can. The
          // proxy (proxy.ts) refreshes the session before any page renders, so nothing is lost.
        }
      },
    },
  });
}
