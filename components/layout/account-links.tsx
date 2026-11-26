import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/user";
import { ACCOUNT_PATH, JOIN_PATH, SIGN_IN_PATH } from "@/lib/site/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";

// The concept's small header buttons: outlined in white, or solid brass.
const OUTLINED =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current px-3.5 py-1.5 text-small font-semibold whitespace-nowrap text-white no-underline hover:bg-white/8";
const SOLID =
  "inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-small font-semibold whitespace-nowrap text-primary-dark no-underline hover:brightness-105";

/**
 * Sign in and Join for a visitor, My Account for a signed-in member. It reads the session, so
 * render it inside <Suspense> with <AccountLinksPlaceholder> as the fallback.
 */
export async function AccountLinks() {
  // Without Supabase settings (a preview made before the Society's accounts exist), nobody can be
  // signed in, and every page should still render.
  const user = readSupabaseConfig() ? await getCurrentUser() : null;

  if (user) {
    return (
      <Link href={ACCOUNT_PATH} className={OUTLINED}>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="5.5" r="2.75" />
          <path d="M2.75 14c.6-2.6 2.7-4 5.25-4s4.65 1.4 5.25 4" strokeLinecap="round" />
        </svg>
        My Account
      </Link>
    );
  }
  return (
    <>
      <Link href={SIGN_IN_PATH} className={OUTLINED}>
        Sign in
      </Link>
      <Link href={JOIN_PATH} className={SOLID}>
        Join
      </Link>
    </>
  );
}

/** Keeps the account links' space while the session is checked, so the header doesn't jump. */
export function AccountLinksPlaceholder() {
  return (
    <span aria-hidden="true" className="invisible inline-flex gap-2">
      <span className={OUTLINED}>Sign in</span>
      <span className={SOLID}>Join</span>
    </span>
  );
}
