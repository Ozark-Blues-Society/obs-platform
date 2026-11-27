import { useId } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { JOIN_PATH } from "@/lib/site/navigation";

/**
 * The Sponsors page's brass band. Sponsor is a membership level (board decisions §1), so its
 * button goes to Membership Benefits & Join.
 */
export function BecomeASponsor({ className }: { className?: string }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        "flex flex-wrap items-center justify-between gap-5 rounded-card bg-accent p-8 text-primary-dark",
        className,
      )}
    >
      <div>
        <h2 id={headingId} className="text-h3">
          Become a sponsor
        </h2>
        <p className="mt-1">Support live blues in the Ozarks, and see your business here.</p>
      </div>
      {/* The usual focus outline barely shows on brass (tokens.md), so this one is navy. */}
      <ButtonLink href={JOIN_PATH} variant="dark" className="focus-visible:outline-primary-dark">
        Join as a sponsor
      </ButtonLink>
    </section>
  );
}
