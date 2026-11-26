import { useId } from "react";
import { ButtonLink } from "@/components/ui/button";

type MembershipCtaProps = {
  /** "Membership starts at $30 a year." */
  heading: string;
  text?: string;
  /** The button: "See membership benefits", to Membership Benefits & Join. */
  action: { label: string; href: string };
};

/** The brass band that asks visitors to join. */
export function MembershipCta({ heading, text, action }: MembershipCtaProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="bg-accent py-12 text-primary-dark">
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-between gap-5 px-gutter">
        <div>
          <h2 id={headingId}>{heading}</h2>
          {text && <p className="mt-1">{text}</p>}
        </div>
        {/* The usual focus outline barely shows on brass (tokens.md), so this one is navy. */}
        <ButtonLink
          href={action.href}
          variant="dark"
          className="focus-visible:outline-primary-dark"
        >
          {action.label}
        </ButtonLink>
      </div>
    </section>
  );
}
