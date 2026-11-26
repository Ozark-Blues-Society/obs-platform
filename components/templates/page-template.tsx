import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LockIcon } from "@/components/ui/lock-icon";
import { Tag } from "@/components/ui/tag";

type PageTemplateProps = {
  /** The page's title, shown in the page header. A hero shows its own headline instead. */
  title: string;
  /** A sentence under the title. */
  intro?: string;
  /** Adds a "Members only" tag above the title: the page is limited to members or some levels. */
  membersOnly?: boolean;
  /**
   * The page's first block, when it's a hero (as on Band Spotlight and Promo Feature pages). Its
   * headline is the page's title, so it takes the page header's place.
   */
  hero?: ReactNode;
  /** The page's blocks, top to bottom (after the hero, if there is one). */
  children: ReactNode;
};

/**
 * A page built from blocks in the Studio, in any of the four templates (Standard, Directory, Band
 * Spotlight, Promo Feature). The templates differ in the blocks they start with, and in whether
 * a hero photo or the blue page header opens the page. Each block sets its own width: text stays
 * at a readable measure, while tables, event lists and sponsor logos use the full width.
 */
export function PageTemplate({
  title,
  intro,
  membersOnly = false,
  hero,
  children,
}: PageTemplateProps) {
  return (
    <>
      {hero ?? (
        <PageHeader
          title={title}
          intro={intro}
          eyebrow={
            membersOnly && (
              <Tag tone="accent">
                <LockIcon className="size-3" />
                Members only
              </Tag>
            )
          }
        />
      )}
      <div className="mx-auto flex w-full max-w-site flex-col gap-10 px-gutter py-10 md:pb-section">
        {children}
      </div>
    </>
  );
}
