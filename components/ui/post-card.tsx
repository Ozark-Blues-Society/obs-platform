import Link from "next/link";
import type { ReactNode } from "react";
import { formatSocietyDate } from "@/lib/society-time";
import { Card } from "./card";
import { cardLinkClasses } from "./card-link";
import { LockIcon } from "./lock-icon";
import { Tag } from "./tag";

type PostCardProps = {
  title: string;
  /** The post's page. The whole card links there. */
  href: string;
  publishedAt: string | Date;
  /** The category's title, for example "Recap". */
  category?: string;
  /**
   * The cover photo, filling the card's 150px-high image area (for example `next/image` with
   * `fill` and `object-cover`). A placeholder shows without one.
   */
  cover?: ReactNode;
  /** Adds a "Members only" tag. */
  membersOnly?: boolean;
  headingLevel?: 2 | 3;
} & (
  | { locked?: false; excerpt?: string }
  /**
   * A members-only post the viewer can't read. It takes no excerpt, so none reaches the page: a
   * blurred stand-in sentence shows instead.
   */
  | { locked: true; excerpt?: never }
);

/** A blog post in a list: the cover, tags, date, title and excerpt. */
export function PostCard(props: PostCardProps) {
  const { title, href, publishedAt, category, cover, headingLevel = 3 } = props;
  const membersOnly = props.locked || props.membersOnly;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <Card as="article" className="relative overflow-hidden">
      <div className="relative h-37.5 bg-linear-135 from-primary to-primary-light">{cover}</div>
      <div className="p-4.5">
        <p className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {membersOnly && (
            <Tag tone="accent">
              <LockIcon className="size-3" />
              Members only
            </Tag>
          )}
          {category && <Tag>{category}</Tag>}
          <time dateTime={new Date(publishedAt).toISOString()} className="text-small text-muted">
            {formatSocietyDate(publishedAt)}
          </time>
        </p>
        <Heading className="text-h3">
          <Link href={href} className={cardLinkClasses}>
            {title}
          </Link>
        </Heading>
        {props.locked ? (
          <p className="mt-2 text-small text-muted">
            <span className="sr-only">This post is for members. Sign in or join to read it.</span>
            <span aria-hidden="true" className="blur-xs select-none">
              Members of the Ozark Blues Society can read this post when they sign in.
            </span>
          </p>
        ) : (
          props.excerpt && <p className="mt-2 text-small text-muted">{props.excerpt}</p>
        )}
      </div>
    </Card>
  );
}
