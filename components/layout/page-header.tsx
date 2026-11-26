import type { ReactNode } from "react";

type PageHeaderProps = {
  /** The page's level-1 heading. */
  title: ReactNode;
  /** A sentence under the title. */
  intro?: ReactNode;
  /** A short label above the title. */
  eyebrow?: ReactNode;
  /** Anything else for the band, such as a "Members only" tag. */
  children?: ReactNode;
};

/** The blue band at the top of a page, holding its title (the concept's page header). */
export function PageHeader({ title, intro, eyebrow, children }: PageHeaderProps) {
  return (
    <div className="bg-primary text-white">
      <div className="mx-auto w-full max-w-site px-gutter pt-10 pb-8.5">
        {eyebrow && <p className="mb-2 text-eyebrow text-accent-light uppercase">{eyebrow}</p>}
        <h1>{title}</h1>
        {intro && <p className="mt-2 max-w-prose text-muted-on-dark">{intro}</p>}
        {children}
      </div>
    </div>
  );
}
