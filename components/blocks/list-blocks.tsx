import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { CardGrid } from "@/components/ui/card-grid";
import { EventCard } from "@/components/ui/event-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { SponsorLogo } from "@/components/ui/sponsor-logo";
import { Table } from "@/components/ui/table";
import { EVENTS_PATH } from "@/sanity/paths";
import { SearchableTable } from "./searchable-table";
import { stringColumns, stringRows } from "./string-table";

type TableBlockProps = {
  /** The heading above the table, which also names it for screen readers. */
  heading: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  /** Adds a search box with this label that filters the rows as people type. */
  searchLabel?: string;
  /** A note between the heading and the table, such as why a column isn't shown. */
  notice?: ReactNode;
};

/** The table block: a heading and a table, searchable on Directory pages. */
export function TableBlock({ heading, columns, rows, searchLabel, notice }: TableBlockProps) {
  return (
    <div>
      <SectionHeading title={heading} />
      {notice}
      {searchLabel ? (
        <SearchableTable
          caption={heading}
          columns={columns}
          rows={rows}
          searchLabel={searchLabel}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table
            caption={heading}
            hideCaption
            columns={stringColumns(columns)}
            rows={stringRows(rows)}
            rowKey={(row) => row.key}
          />
        </Card>
      )}
    </div>
  );
}

export type BlockEvent = Omit<ComponentProps<typeof EventCard>, "headingLevel">;

/** The upcoming events block: the next events from the calendar, with a link to the calendar. */
export function UpcomingEventsBlock({
  heading,
  events,
}: {
  heading: string;
  events: readonly BlockEvent[];
}) {
  return (
    <div>
      <SectionHeading title={heading} action={{ label: "Full calendar", href: EVENTS_PATH }} />
      {events.length > 0 ? (
        <CardGrid>
          {events.map((event) => (
            // A repeating event's dates share its page, so the key needs the date too.
            <li key={`${event.href} ${String(event.startsAt)}`}>
              <EventCard {...event} />
            </li>
          ))}
        </CardGrid>
      ) : (
        <p className="text-muted">Nothing on the calendar yet. Check back soon.</p>
      )}
    </div>
  );
}

export type BlockSponsor = { name: string; href?: string; logo?: ReactNode };

/** The sponsor logos block: a heading and the sponsors' logos (the Promo Feature's credits). */
export function SponsorStripBlock({
  heading,
  sponsors,
}: {
  heading: string;
  sponsors: readonly BlockSponsor[];
}) {
  if (sponsors.length === 0) return null;
  return (
    <Card className="p-6 text-center">
      <h2 className="text-h3">{heading}</h2>
      <ul className="mt-4 flex flex-wrap justify-center gap-3">
        {sponsors.map((sponsor) => (
          <li key={sponsor.name}>
            <SponsorLogo name={sponsor.name} href={sponsor.href} logo={sponsor.logo} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
