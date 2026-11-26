import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { ButtonLink } from "./button";
import { LockIcon } from "./lock-icon";

type LockOverlayProps = {
  title?: string;
  /** What signing in or joining unlocks, for example "Sign in to see the venue directory." */
  description?: ReactNode;
  /** Where Sign in goes. Add `?next=` so the member comes back here. */
  signInHref?: string;
  /** Where Join now goes (Membership Benefits & Join). */
  joinHref?: string;
  /**
   * Buttons to show instead of Sign in and Join now, for someone already signed in: Renew, for
   * example (components/members/members-only-lock.tsx).
   */
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * What a visitor sees in place of members-only content: a lock box over a blurred placeholder.
 *
 * It never takes the content itself. Blurring real text still sends it to the browser, where
 * anyone can read it, so the server leaves members-only content out of the page entirely
 * (decision 0001) and shows this instead.
 */
export function LockOverlay({
  title = "This page is for members",
  description = "Sign in to see it, or join the Society.",
  signInHref = "/sign-in",
  joinHref = "/join",
  actions,
  headingLevel = 2,
  className,
}: LockOverlayProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div
      className={cx(
        "relative min-h-72 overflow-hidden rounded-card border border-line bg-surface shadow-card",
        className,
      )}
    >
      <Placeholder />
      <div className="absolute inset-0 flex items-end justify-center bg-linear-to-b from-canvas/20 to-canvas/97 to-45% p-4 sm:p-6">
        <div className="w-full max-w-105 rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <LockIcon className="mx-auto size-8 text-accent-dark" />
          <Heading className="mt-2 text-h3">{title}</Heading>
          <p className="mt-2 text-small text-muted">{description}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {actions ?? (
              <>
                <ButtonLink href={signInHref} variant="dark" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href={joinHref} size="sm">
                  Join now
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Blurred bars that suggest rows of content without containing any. */
function Placeholder() {
  return (
    <div aria-hidden="true" className="grid gap-5 p-5 blur-xs select-none">
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex gap-6">
          <span className="h-3 w-1/4 rounded-sm bg-muted-soft" />
          <span className="h-3 w-1/5 rounded-sm bg-muted-soft" />
          <span className="h-3 w-1/3 rounded-sm bg-muted-soft" />
        </div>
      ))}
    </div>
  );
}
