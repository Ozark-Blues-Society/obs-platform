/** Where members land after signing in when no other page asked for them. */
export const DEFAULT_AFTER_SIGN_IN = "/account";

// A placeholder origin for resolving paths. Nothing is ever fetched from it.
const BASE = "https://site.invalid";

/**
 * Returns `value` if it's a safe place to send someone after signing in: a path on this site.
 * Anything else falls back to My Account: full or protocol-relative URLs (`//elsewhere.com`),
 * backslashes, control characters, and the sign-in pages themselves (they would loop).
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  // Browsers treat "\" like "/" in URLs, so "/\elsewhere.com" would leave the site.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) {
    return DEFAULT_AFTER_SIGN_IN;
  }

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
  if (url.origin !== BASE || isSignInPath(url.pathname)) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isSignInPath(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}
