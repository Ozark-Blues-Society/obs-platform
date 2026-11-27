import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { EventsCalendar } from "@/components/events/events-calendar";
import { PageHeader } from "@/components/layout/page-header";
import { readCalendarParams } from "@/lib/events/calendar-params";
import { FEED_PATH } from "@/lib/events/ics";
import { loadEventOccurrences, loadUpcomingEvents } from "@/lib/events/load";
import { siteUrl } from "@/lib/site/site-url";
import { isoDate, monthName, monthRange, societyWallClock } from "@/lib/society-time";

// The events calendar (backlog P-2, the approved concept's Events page): ?month=2026-12 picks
// the month (this month by default), ?view=list shows it as a list, ?category=jam filters it.
// Events are read through sanity/content, so members-only events come without their venue for a
// viewer who may not see them. It reads the session, so the calendar renders at request time.

type SearchParams = PageProps<"/events">["searchParams"];

export async function generateMetadata({ searchParams }: PageProps<"/events">): Promise<Metadata> {
  // The month is in the title, as in the calendar's heading.
  const params = await searchParams;
  // Today's month is the default: read the clock at request time only (see Calendar).
  await connection();
  const { month } = readCalendarParams(params, new Date());
  return { title: `Events in ${monthName(month)} · Ozark Blues Society` };
}

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <PageHeader title="Events" intro="Concerts, jams, workshops and society gatherings." />
      <Suspense
        fallback={
          <p className="mx-auto w-full max-w-site px-gutter py-10">Loading the calendar…</p>
        }
      >
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: { searchParams: SearchParams }) {
  // The address first, then connection(): Next.js refuses a clock read before the render is at
  // request time, and the address alone isn't enough with partial prefetching.
  const params = await searchParams;
  await connection();
  const now = new Date();
  const { month } = readCalendarParams(params, now);
  const { start, end } = monthRange(month);
  const [dates, upcoming, origin] = await Promise.all([
    loadEventOccurrences(start, end),
    loadUpcomingEvents(now, { eachEventOnce: true }),
    siteAddress(),
  ]);
  const feed = new URL(FEED_PATH, origin);

  return (
    <EventsCalendar
      // No key: moving to another month keeps the calendar, so focus stays on the arrow and the
      // status line says which month it is now. The view and the category are read from the
      // address in the browser (useSearchParams), so Back and Forward bring back what it says.
      month={month}
      today={isoDate(societyWallClock(now))}
      dates={dates}
      upcoming={upcoming}
      feed={{ https: feed.href, webcal: feed.href.replace(/^https?:/, "webcal:") }}
    />
  );
}

/** The site's address for the feed links: SITE_URL, or else the address this request came to. */
async function siteAddress(): Promise<string> {
  try {
    return siteUrl();
  } catch {
    const request = await headers();
    const host = request.get("x-forwarded-host") ?? request.get("host") ?? "localhost";
    return `${request.get("x-forwarded-proto") ?? "http"}://${host}`;
  }
}
