import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { ButtonLink } from "./button";
import { Card } from "./card";
import { Tag } from "./tag";

type SponsorSpotlightProps = {
  name: string;
  /** The sponsor's website. Adds a "Visit" button. */
  href?: string;
  /** A sentence or two about the sponsor and the Society. */
  blurb?: string;
  /** The sponsor's logo, with the sponsor's name as its alt text. The name shows until there is one. */
  logo?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * The featured sponsor (one at a time): a logo panel, the sponsor's blurb and a link to its
 * website. It appears on the home page and the Sponsors page (docs/spec/scope.md, Sponsors).
 */
export function SponsorSpotlight({
  name,
  href,
  blurb,
  logo,
  headingLevel = 2,
  className,
}: SponsorSpotlightProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <Card className={cx("grid overflow-hidden sm:grid-cols-2", className)}>
      <div className="flex min-h-45 items-center justify-center bg-linear-135 from-primary-dark to-primary-light p-5 text-center font-serif text-[1.875rem] leading-tight text-accent-light">
        {logo ?? name}
      </div>
      <div className="p-6">
        <Tag tone="accent">Featured sponsor</Tag>
        <Heading className="mt-2.5">Sponsor spotlight</Heading>
        {blurb && <p className="mt-2">{blurb}</p>}
        {href && (
          <ButtonLink href={href} variant="dark" size="sm" className="mt-4">
            Visit {name} <span aria-hidden="true">&rarr;</span>
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}
