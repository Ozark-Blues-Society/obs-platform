"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { EventCard } from "@/components/ui/event-card";
import { PillFilters, type PillOption } from "@/components/ui/pill-filters";
import { cx } from "@/lib/cx";
import {
  CATEGORY_FILTERS,
  calendarHref,
  type CalendarView,
  type CategoryFilter,
} from "@/lib/events/calendar-params";
import { eventCardProps } from "@/lib/events/cards";
import type { EventOccurrence } from "@/lib/events/load";
import { addMonths, monthName } from "@/lib/society-time";
import { FeedLinks, type FeedAddress } from "./feed-links";
import { MonthGrid } from "./month-grid";

const VIEWS: readonly PillOption<CalendarView>[] = [
  { value: "month", label: "Month" },
  { value: "list", label: "List" },
];

/** How many events "Coming up" lists. */
const COMING_UP = 5;

type EventsCalendarProps = {
  /** The month shown, written "2026-11". */
  month: string;
  /** Today on the Society's calendar (YYYY-MM-DD). */
  today: string;
  view: CalendarView;
  category: CategoryFilter;
  /** Every event date in the month, earliest first. */
  dates: readonly EventOccurrence[];
  /** Each event's next date, earliest first, for "Coming up". */
  upcoming: readonly EventOccurrence[];
  feed: FeedAddress;
};

/**
 * The events calendar (backlog P-2, the approved concept's Events page): category filters, the
 * month as a grid or a list with links to the months before and after, "Coming up" and the
 * calendar feed. The category and the view change here, in the browser, and the address follows
 * them, so a link to the page keeps them; moving to another month loads that month's events.
 */
export function EventsCalendar({
  month,
  today,
  view: firstView,
  category: firstCategory,
  dates,
  upcoming,
  feed,
}: EventsCalendarProps) {
  const [view, setView] = useState(firstView);
  const [category, setCategory] = useState(firstCategory);
  const titleId = useId();
  const inCategory = (date: EventOccurrence) => category === "all" || date.category === category;
  const shown = dates.filter(inCategory);
  const comingUp = upcoming.filter(inCategory).slice(0, COMING_UP);
  const categoryName = CATEGORY_FILTERS.find((option) => option.value === category)?.label;
  const name = monthName(month);

  return (
    <div className="mx-auto w-full max-w-site px-gutter pt-7 pb-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PillFilters
          label="Event category"
          options={CATEGORY_FILTERS}
          value={category}
          onChange={(value) => {
            setCategory(value);
            followInAddress("category", value === "all" ? null : value);
          }}
        />
        <PillFilters
          label="Show the calendar as"
          options={VIEWS}
          value={view}
          onChange={(value) => {
            setView(value);
            followInAddress("view", value === "month" ? null : value);
          }}
        />
      </div>
      <p role="status" className="sr-only">
        {`${shown.length} ${shown.length === 1 ? "date" : "dates"}${category === "all" ? "" : ` (${categoryName})`} in ${name}`}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby={titleId} className="min-w-0">
          <Card className={cx(view === "month" && "overflow-hidden")}>
            <div className="flex items-center justify-between gap-2 border-b border-line px-4.5 py-3.5">
              <MonthLink
                month={addMonths(month, -1)}
                label="Previous month"
                view={view}
                category={category}
              >
                ‹
              </MonthLink>
              <h2 id={titleId} className="text-h3">
                {name}
              </h2>
              <MonthLink
                month={addMonths(month, 1)}
                label="Next month"
                view={view}
                category={category}
              >
                ›
              </MonthLink>
            </div>
            {view === "month" ? (
              <MonthGrid month={month} labelledBy={titleId} today={today} dates={shown} />
            ) : (
              shown.length > 0 && (
                <ul className="grid gap-3 p-4">
                  {shown.map((date) => (
                    <li key={date.key}>
                      <EventCard {...eventCardProps(date)} />
                    </li>
                  ))}
                </ul>
              )
            )}
            {shown.length === 0 && (
              <p className="px-4.5 py-4 text-muted">
                Nothing on the calendar in {name}
                {category === "all" ? "" : ` under ${categoryName}`}.
              </p>
            )}
          </Card>
        </section>

        <aside aria-labelledby={`${titleId}-coming-up`}>
          <h2 id={`${titleId}-coming-up`} className="text-h3">
            Coming up
          </h2>
          {comingUp.length > 0 ? (
            <ul className="mt-3 grid gap-3">
              {comingUp.map((date) => (
                <li key={date.key}>
                  <EventCard {...eventCardProps(date)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">Nothing coming up yet. Check back soon.</p>
          )}
          <FeedLinks feed={feed} />
        </aside>
      </div>
    </div>
  );
}

function MonthLink({
  month,
  label,
  view,
  category,
  children,
}: {
  month: string;
  label: string;
  view: CalendarView;
  category: CategoryFilter;
  children: string;
}) {
  return (
    <Link
      href={calendarHref(month, view, category)}
      aria-label={`${label}, ${monthName(month)}`}
      className="flex size-8 flex-none items-center justify-center rounded-full border border-line bg-white text-body text-ink no-underline hover:border-line-strong"
    >
      <span aria-hidden="true">{children}</span>
    </Link>
  );
}

/** Puts a choice in the address bar without loading the page again, so a link to it keeps it. */
function followInAddress(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}
