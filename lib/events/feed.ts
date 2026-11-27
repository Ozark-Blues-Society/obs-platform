// The calendar feed's events (backlog P-2): what anyone who subscribes to the calendar gets. It's
// read as a visitor sees the site, published events only, whoever asks (listPublicItems), so a
// members-only event is in the feed with its public fields only (decision 0001).
import "server-only";
import { isoDate, societyInstant, societyWallClock } from "@/lib/society-time";
import { listPublicItems } from "@/sanity/content";
import { CALENDAR_CONTENT, calendarEntry, type CalendarContent } from "./calendar-entry";
import type { CalendarEntry } from "./ics";
import { EVENT_WINDOW_FILTER } from "./load";

/** How far back the feed keeps events that are over, in days, and how far ahead it looks, in years. */
const FEED_PAST_DAYS = 30;
const FEED_YEARS_AHEAD = 2;

/**
 * The feed's entries at `now`, with links to `origin`: every event with a date from 30 days ago
 * to two years ahead. A repeating event is one entry with its repeats, so calendar apps fill in
 * the dates. Sanity is asked the same question all day: one cache entry a day.
 */
export async function loadFeedEntries(now: Date, origin: string): Promise<CalendarEntry[]> {
  const { year, month, day } = societyWallClock(now);
  const from = societyInstant({ year, month, day: day - FEED_PAST_DAYS, hour: 0, minute: 0 });
  const to = societyInstant({ year: year + FEED_YEARS_AHEAD, month, day, hour: 0, minute: 0 });
  const events = await listPublicItems<"event", CalendarContent>("event", CALENDAR_CONTENT, {
    filter: EVENT_WINDOW_FILTER,
    order: "start asc",
    params: {
      from: from.toISOString(),
      to: to.toISOString(),
      fromDate: isoDate(societyWallClock(from)),
    },
  });
  return events.flatMap((event) => calendarEntry(event, origin) ?? []);
}
