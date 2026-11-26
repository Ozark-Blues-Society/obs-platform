import Link from "next/link";
import { eventDateParts } from "@/lib/society-time";
import { Card } from "./card";
import { cardLinkClasses } from "./card-link";
import { Tag } from "./tag";

type EventCardProps = {
  title: string;
  /** The event's page. The whole card links there. */
  href: string;
  /** When it starts (an ISO date-time). The card shows it in the Society's time zone. */
  startsAt: string | Date;
  /** The category's title, for example "Concert". */
  category?: string;
  /** Adds a "Weekly" or "Monthly" tag to a repeating event. */
  repeats?: "weekly" | "monthly";
  /** Adds a "Members only" tag. */
  membersOnly?: boolean;
  /** The venue's name. Leave it out where the viewer may not see it. */
  venue?: string;
  /** The price as editors wrote it: "$15", "Free". */
  price?: string;
  /** The members' price, for example "$10". */
  memberPrice?: string;
  headingLevel?: 2 | 3;
};

/** An event in a list: a date badge, tags, the title, where and when, and the price. */
export function EventCard({
  title,
  href,
  startsAt,
  category,
  repeats,
  membersOnly = false,
  venue,
  price,
  memberPrice,
  headingLevel = 3,
}: EventCardProps) {
  const { iso, month, day, time } = eventDateParts(startsAt);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const priceLine = [price, memberPrice && `Members ${memberPrice}`].filter(Boolean).join(" · ");
  const hasTags = membersOnly || Boolean(category) || Boolean(repeats);

  return (
    <Card as="article" className="relative flex gap-4 p-4.5">
      <time
        dateTime={iso}
        className="flex w-14.5 flex-none flex-col items-center rounded-lg bg-primary py-2 text-white"
      >
        <span className="text-tag tracking-widest text-accent-light uppercase">{month}</span>
        <span className="font-serif text-[1.625rem] leading-none">{day}</span>
      </time>
      <div className="min-w-0">
        {hasTags && (
          <p className="mb-1 flex flex-wrap gap-1">
            {membersOnly && <Tag tone="accent">Members only</Tag>}
            {category && <Tag>{category}</Tag>}
            {repeats && <Tag tone="muted">{repeats === "weekly" ? "Weekly" : "Monthly"}</Tag>}
          </p>
        )}
        <Heading className="font-sans text-body font-semibold">
          <Link href={href} className={cardLinkClasses}>
            {title}
          </Link>
        </Heading>
        <p className="text-small text-muted">{[venue, time].filter(Boolean).join(" · ")}</p>
        {priceLine && <p className="text-small">{priceLine}</p>}
      </div>
    </Card>
  );
}
