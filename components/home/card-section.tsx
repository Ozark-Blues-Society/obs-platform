import { useId, type ComponentProps, type ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { cx } from "@/lib/cx";

type CardSectionProps = Pick<
  ComponentProps<typeof SectionHeading>,
  "eyebrow" | "title" | "action"
> & {
  /** The cards, each in an `<li>`. */
  children: ReactNode;
  className?: string;
};

/** A home page section of cards (upcoming events, the latest posts) under a heading. */
export function CardSection({ eyebrow, title, action, children, className }: CardSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cx("mx-auto w-full max-w-site px-gutter", className)}
    >
      <SectionHeading id={headingId} eyebrow={eyebrow} title={title} action={action} />
      <CardGrid>{children}</CardGrid>
    </section>
  );
}
