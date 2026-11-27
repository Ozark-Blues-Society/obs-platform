import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  eventDateParts,
  formatCalendarDate,
  formatSocietyLongDate,
  formatSocietyShortDate,
} from "@/lib/society-time";

export type EventVenue = { name: string; address?: string | null; mapUrl?: string | null };

type EventDetailsProps = {
  /** The first (or only) start, as an ISO 8601 instant. */
  startsAt: string;
  /** How it repeats ("Every Tuesday"), its last date (YYYY-MM-DD) and the next few dates. */
  repeats?: { text: string; until: string | null; next: readonly string[] } | null;
  /** Whether every date is over. */
  over?: boolean;
  /** Whether the viewer may not see the event: then the place stays hidden. */
  locked: boolean;
  venue?: EventVenue | null;
  price?: string | null;
  memberPrice?: string | null;
  /** Whether the viewer is a member whose membership is active: their price is highlighted. */
  member?: boolean;
  /** The event's calendar file ("Add to calendar"), for viewers who may see it. */
  calendarHref?: string | null;
};

/** The event page's facts: when, where and what it costs, and "Add to calendar". */
export function EventDetails({
  startsAt,
  repeats,
  over = false,
  locked,
  venue,
  price,
  memberPrice,
  member = false,
  calendarHref,
}: EventDetailsProps) {
  const { iso, time } = eventDateParts(startsAt);
  const priceLine = [price, memberPrice && `Members ${memberPrice}`].filter(Boolean).join(" · ");
  const mapUrl = venue?.mapUrl && isWebAddress(venue.mapUrl) ? venue.mapUrl : null;

  return (
    <Card as="section" aria-label="Event details" className="grid gap-5 p-5">
      <dl className="grid gap-4">
        <Detail term="When">
          {repeats ? (
            <>
              <p className="font-semibold">
                {repeats.text}, {time}
              </p>
              {repeats.until && (
                <p className="text-small text-muted">Until {formatCalendarDate(repeats.until)}</p>
              )}
              {repeats.next.length > 0 && (
                <>
                  <p className="mt-2 text-small">Next dates:</p>
                  <ul className="text-small">
                    {repeats.next.map((date) => (
                      <li key={date}>
                        <time dateTime={date}>{formatSocietyShortDate(date)}</time>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="font-semibold">
              <time dateTime={iso}>
                {formatSocietyLongDate(startsAt)} · {time}
              </time>
            </p>
          )}
          {over && <p className="mt-1 text-small text-muted">This event is over.</p>}
        </Detail>

        {locked ? (
          <Detail term="Where">
            <p className="text-muted italic">Location visible to members</p>
          </Detail>
        ) : (
          venue && (
            <Detail term="Where">
              <p className="font-semibold">{venue.name}</p>
              {venue.address && <p className="text-small">{venue.address}</p>}
              {mapUrl && (
                <p className="text-small">
                  <a href={mapUrl}>Map and directions</a>
                </p>
              )}
            </Detail>
          )
        )}

        {priceLine && (
          <Detail term="Price">
            <p>{priceLine}</p>
            {member && memberPrice && (
              <p className="mt-1">
                <Tag tone="success">Your member price: {memberPrice}</Tag>
              </p>
            )}
          </Detail>
        )}
      </dl>

      {calendarHref && !over && (
        // A plain link: a calendar file isn't a page to prefetch. The response downloads it, and
        // phones offer to add it to the calendar.
        <a href={calendarHref} className={buttonClasses({ variant: "dark", size: "sm" })}>
          Add to calendar
        </a>
      )}
    </Card>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-tag text-muted uppercase">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function isWebAddress(value: string): boolean {
  const url = URL.parse(value);
  return url?.protocol === "https:" || url?.protocol === "http:";
}
