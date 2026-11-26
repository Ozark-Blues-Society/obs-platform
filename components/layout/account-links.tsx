import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/user";
import { cx } from "@/lib/cx";
import { ACCOUNT_PATH, JOIN_PATH, SIGN_IN_PATH } from "@/lib/site/navigation";
import { readSupabaseConfig } from "@/lib/supabase/config";

// The concept's small header buttons: outlined in the header's white text, or solid brass. Each
// stays on one line.
const OUTLINED = { variant: "ghost", size: "sm" } as const;
const SOLID = { variant: "primary", size: "sm" } as const;
const ONE_LINE = "whitespace-nowrap";

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
      <ButtonLink href={ACCOUNT_PATH} {...OUTLINED} className={ONE_LINE}>
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
      </ButtonLink>
    );
  }
  return (
    <>
      <ButtonLink href={SIGN_IN_PATH} {...OUTLINED} className={ONE_LINE}>
        Sign in
      </ButtonLink>
      <ButtonLink href={JOIN_PATH} {...SOLID} className={ONE_LINE}>
        Join
      </ButtonLink>
    </>
  );
}

/** Keeps the account links' space while the session is checked, so the header doesn't jump. */
export function AccountLinksPlaceholder() {
  return (
    <span aria-hidden="true" className="invisible inline-flex gap-2">
      <span className={cx(buttonClasses(OUTLINED), ONE_LINE)}>Sign in</span>
      <span className={cx(buttonClasses(SOLID), ONE_LINE)}>Join</span>
    </span>
  );
}
