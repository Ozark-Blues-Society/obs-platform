import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** The card classes, for an element `<Card>` can't render (a link, a table wrapper). */
export const cardClasses = "rounded-card border border-line bg-surface shadow-card";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** `article` for a self-contained item (an event, a post), `li` inside a list. */
  as?: "div" | "article" | "section" | "li";
};

/** A paper-colored panel with a soft shadow. It has no padding: add it with `className`. */
export function Card({ as: Element = "div", className, ...props }: CardProps) {
  return <Element className={cx(cardClasses, className)} {...props} />;
}
