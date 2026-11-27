import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";

type HeroBlockProps = {
  heading: string;
  /** A short label above the heading, such as the template's name ("Band Spotlight"). */
  eyebrow?: string;
  /** A tag above the eyebrow, such as "Members only" on a page limited to members. */
  tag?: ReactNode;
  /** A sentence or two under the heading. */
  text?: string;
  /** The wide photo behind the heading (for example `next/image` with `fill`). */
  photo: ReactNode;
  /** A button under the text ("Apply to compete"). */
  button?: { label: string; href: string };
  /** 1 when the hero holds the page's title, as it does when it's the page's first block. */
  headingLevel?: 1 | 2;
};

/**
 * The hero block: a wide photo with the headline over it. A page that starts with one (Band
 * Spotlight and Promo Feature pages do) uses its headline as the page title.
 */
export function HeroBlock({
  heading,
  eyebrow,
  tag,
  text,
  photo,
  button,
  headingLevel = 2,
}: HeroBlockProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="relative isolate overflow-hidden bg-primary-dark text-white">
      <div className="absolute inset-0 -z-10">{photo}</div>
      {/* Darkens the photo under the text, so it stays readable whatever the photo. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-primary-dark from-25% via-primary-dark/80 to-primary-dark/20" />
      <div className="mx-auto flex min-h-88 max-w-site flex-col justify-end px-gutter pt-24 pb-10 md:min-h-112">
        {tag && <div className="mb-3">{tag}</div>}
        {eyebrow && <p className="mb-2 text-eyebrow text-accent-light uppercase">{eyebrow}</p>}
        <Heading className="max-w-3xl">{heading}</Heading>
        {text && <p className="mt-3 max-w-2xl text-lead">{text}</p>}
        {button && (
          <ButtonLink href={button.href} className="mt-6 self-start">
            {button.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
