import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A list of cards (events, posts) in as many 260px-wide columns as fit: three or four on a
 * computer, one on a phone. Put each card in an `<li>`.
 */
export function CardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cx(
        "grid grid-cols-[repeat(auto-fill,minmax(min(100%,16.25rem),1fr))] gap-5",
        className,
      )}
    >
      {children}
    </ul>
  );
}
