import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readSupabaseConfig } from "./config";

/**
 * Path prefixes that only signed-in members can open. Visitors are sent to sign in first. The
 * admin screens also need a staff role, which each admin page checks itself.
 */
const MEMBER_ONLY_PREFIXES = ["/account", "/admin"];

let warnedUnconfigured = false;

/**
 * Runs on every request (see proxy.ts). It refreshes the member's session when the access token
 * has expired, passing the new cookies on to the page being rendered and back to the browser.
 * Server Components can't write cookies, so without this a refreshed session would be lost. It also
 * sends visitors who open a members-only path to the sign-in page.
 *
 * This is an early redirect, not the security check: pages and Server Functions check the session
 * again themselves (lib/auth/user.ts).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const config = readSupabaseConfig();
  if (!config) {
    // Public pages still work without Supabase (for example a design preview deploy); sign-in and
    // My Account report the missing configuration when they're used.
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn("Supabase isn't configured, so sessions are not refreshed. See .env.example.");
    }
    return NextResponse.next({ request });
  }

  const cookieChanges: { name: string; value: string; options: CookieOptions }[] = [];
  const headerChanges: Record<string, string> = {};

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Pages rendered for this request read the request's cookies, so update those too.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        cookieChanges.push(...cookiesToSet);
        Object.assign(headerChanges, headers);
      },
    },
  });

  // Checks the session and refreshes it if it has expired. Keep this the first call on the client:
  // anything that ran before it would see the stale session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;
  const response =
    !signedIn && isMemberOnly(pathname)
      ? NextResponse.redirect(signInUrl(request, pathname + search))
      : NextResponse.next({ request });

  for (const { name, value, options } of cookieChanges) {
    response.cookies.set(name, value, options);
  }
  // Supabase asks for these whenever it writes auth cookies, so no cache stores the response.
  for (const [key, value] of Object.entries(headerChanges)) {
    response.headers.set(key, value);
  }
  return response;
}

function isMemberOnly(pathname: string): boolean {
  return MEMBER_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function signInUrl(request: NextRequest, returnTo: string): URL {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", returnTo);
  return url;
}
