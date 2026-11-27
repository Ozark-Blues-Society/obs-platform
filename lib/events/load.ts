// The calendar's events, date by date (backlog P-2), for the events pages and the blocks that list
// upcoming events (C-2's upcoming events block, P-1's home page). Events are read through
// sanity/content, so a viewer who may not see a members-only event gets it without its venue
// (decision 0001). ./occurrences.ts expands the repeats.
//
// Like every sanity/content loader, these read the session: call them inside a <Suspense> boundary.
import "server-only";
import { stegaClean } from "next-sanity";
import { isoDate, societyInstant, societyWallClock } from "@/lib/society-time";
import { listGatedItems, type GatedItem } from "@/sanity/content";
import { eventPath } from "@/sanity/paths";
import { EVENT_CATEGORIES, optionTitle } from "@/sanity/schemas/options";
import { EVENT_LENGTH_MS, occurrencesBetween, readSchedule } from "./occurrences";

/** What a calendar shows of an event besides its public fields: where, if the viewer may see it. */
export const EVENT_LIST_CONTENT = '{ "venue": venue->{ name } }';

/**
 * The events that may happen from $from to $to: those that start in that time, and repeating ones
 * that start before $to and repeat until $fromDate (a date on the Society's calendar) or later, or
 * have no last date yet. It may find more than happen, never fewer: occurrencesBetween then picks
 * the dates. Public fields only (start and recurrence), as sanity/content requires.
 */
export const EVENT_WINDOW_FILTER =
  'dateTime(start) < dateTime($to) && (dateTime(start) >= dateTime($from) || (recurrence.frequency in ["weekly", "monthly"] && (!defined(recurrence.until) || recurrence.until >= $fromDate)))';

/** One date of an event, as calendars and event cards show it. */
export type EventOccurrence = {
  /** Unique for each date: the event's id and this date's start. */
  key: string;
  eventId: string;
  /** The event page's web address, and its last part. */
  href: string;
  slug: string;
  title: string;
  /** This date's start, as an ISO 8601 instant. */
  startsAt: string;
  /** The category as stored ("jam") and as shown ("Jam"), or null. */
  category: string | null;
  categoryTitle: string | null;
  /** How the event repeats, or null if it doesn't. */
  repeats: "weekly" | "monthly" | null;
  /** Whether the event is only for members, or only some levels. */
  membersOnly: boolean;
  /** Whether this viewer may not see the event: then there's no venue. */
  locked: boolean;
  /** The venue's name, only for viewers who may see the event. */
  venue: string | null;
  /** The prices as editors wrote them: "$15", "$10". */
  priceText: string | null;
  memberPrice: string | null;
};

type EventContent = { venue?: { name?: unknown } | null };
type ListedEvent = GatedItem<"event", EventContent>;

/** Every date of every event from `from` (included) to `to` (excluded), earliest first. */
export async function loadEventOccurrences(from: Date, to: Date): Promise<EventOccurrence[]> {
  const events = await listEvents(from, to);
  return events.flatMap((event) => occurrencesOf(event, from, to)).sort(byStart);
}

/**
 * The dates still to come at `now`, earliest first: a date in progress counts until its two hours
 * are over. `count` keeps the first few; `eachEventOnce` keeps only each event's next date, so a
 * weekly jam can't fill a list. Looks a year ahead.
 */
export async function loadUpcomingEvents(
  now: Date,
  { count, eachEventOnce = false }: { count?: number; eachEventOnce?: boolean } = {},
): Promise<EventOccurrence[]> {
  // Sanity is asked the same question all day (from midnight today, less one event's length, for
  // a year), so it's one cache entry a day. The dates that are over are dropped here.
  const { year, month, day } = societyWallClock(now);
  const midnight = societyInstant({ year, month, day, hour: 0, minute: 0 });
  const from = new Date(midnight.getTime() - EVENT_LENGTH_MS);
  const to = societyInstant({ year: year + 1, month, day, hour: 0, minute: 0 });
  const notOver = new Date(Math.max(from.getTime(), now.getTime() - EVENT_LENGTH_MS + 1));
  const perEvent = eachEventOnce ? 1 : count;

  const events = await listEvents(from, to);
  const upcoming = events
    .flatMap((event) => occurrencesOf(event, notOver, to, perEvent))
    .sort(byStart);
  return count === undefined ? upcoming : upcoming.slice(0, count);
}

function listEvents(from: Date, to: Date): Promise<ListedEvent[]> {
  return listGatedItems<"event", EventContent>("event", EVENT_LIST_CONTENT, {
    filter: EVENT_WINDOW_FILTER,
    order: "start asc",
    params: {
      from: from.toISOString(),
      to: to.toISOString(),
      fromDate: isoDate(societyWallClock(from)),
    },
  });
}

/**
 * Text to show, or null if blank. A preview's edit markers stay, for click-to-edit, so it isn't
 * trimmed: trim() would cut the markers' U+FEFF characters.
 */
function text(value: unknown): string | null {
  return typeof value === "string" && stegaClean(value).trim() ? value : null;
}

/** A value the site acts on, without a preview's edit markers. */
function clean(value: unknown): unknown {
  return typeof value === "string" ? stegaClean(value).trim() : value;
}

function occurrencesOf(
  event: ListedEvent,
  from: Date,
  to: Date,
  limit?: number,
): EventOccurrence[] {
  const { frequency, until } = (event.recurrence ?? {}) as { frequency?: unknown; until?: unknown };
  const schedule = readSchedule(clean(event.start), {
    frequency: clean(frequency),
    until: clean(until),
  });
  if (!schedule) return [];
  const stored = clean(event.category);
  const category = typeof stored === "string" && stored ? stored : null;
  const shared = {
    eventId: event._id,
    href: eventPath(event.slug),
    slug: event.slug,
    title: text(event.title) ?? "Untitled event",
    category,
    categoryTitle: category && optionTitle(EVENT_CATEGORIES, category),
    repeats: schedule.repeat?.frequency ?? null,
    membersOnly: event.visibility.audience !== "everyone",
    locked: !event.access.allowed,
    venue: event.access.allowed ? text(event.content?.venue?.name) : null,
    priceText: text(event.priceText),
    memberPrice: text(event.memberPrice),
  };
  return occurrencesBetween(schedule, from, to, limit).map((date) => ({
    ...shared,
    key: `${event._id}@${date.toISOString()}`,
    startsAt: date.toISOString(),
  }));
}

/** Earliest first; dates at the same time by event, so the order never varies. */
function byStart(a: EventOccurrence, b: EventOccurrence): number {
  const first = a.startsAt === b.startsAt ? a.key : a.startsAt;
  const second = a.startsAt === b.startsAt ? b.key : b.startsAt;
  return first < second ? -1 : first > second ? 1 : 0;
}
