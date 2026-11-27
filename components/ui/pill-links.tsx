import Link from "next/link";
import { cx } from "@/lib/cx";
import { pillClasses } from "./pill-classes";

export type PillLink = {
  label: string;
  href: string;
  /** The page being shown: one pill is, such as "All" when no filter is picked. */
  current: boolean;
};

type PillLinksProps = {
  /** Names the list for screen readers, for example "Blog categories". */
  label: string;
  links: readonly PillLink[];
  className?: string;
};

/**
 * A row of pills that link to filtered versions of a page, such as the blog by category: they
 * look like `PillFilters`, but each filter has its own web address, so it works without
 * JavaScript and can be shared or bookmarked. Screen readers announce the shown one as the
 * current page. The page keeps its scroll position when a pill is followed.
 */
export function PillLinks({ label, links, className }: PillLinksProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-1.5">
        {links.map((link) => (
          <li key={link.href} className="flex">
            <Link
              href={link.href}
              scroll={false}
              aria-current={link.current ? "page" : undefined}
              className={cx(pillClasses(link.current), "inline-block")}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
