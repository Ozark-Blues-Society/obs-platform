import { ButtonLink } from "./button";

type SectionHeadingProps = {
  title: string;
  /** For the section's `aria-labelledby`. */
  id?: string;
  /** A short label above the heading ("On the calendar"). */
  eyebrow?: string;
  /** A link to the full list, at the right: "Full calendar". */
  action?: { label: string; href: string };
  headingLevel?: 2 | 3;
};

/** A section's heading, with an eyebrow above it and an optional link to see everything. */
export function SectionHeading({
  title,
  id,
  eyebrow,
  action,
  headingLevel = 2,
}: SectionHeadingProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="mb-4.5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-eyebrow text-accent-dark uppercase">{eyebrow}</p>}
        <Heading id={id}>{title}</Heading>
      </div>
      {action && (
        <ButtonLink href={action.href} variant="dark" size="sm">
          {action.label} <span aria-hidden="true">&rarr;</span>
        </ButtonLink>
      )}
    </div>
  );
}
