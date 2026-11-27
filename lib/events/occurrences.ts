// When an event happens, date by date (backlog P-2). The calendar, the event pages, the calendar
// feeds and the blocks that list upcoming events all expand an event's repeats here. An event has
// one start, entered and shown in Central Time, and may repeat (sanity/schemas/documents/event.ts):
// - weekly: every 7 days, at the same time on the Society's clocks, so a 7 PM jam stays at 7 PM
//   when daylight saving time starts or ends;
// - monthly: on the first date's weekday, in the same week of the month, so a first Friday repeats
//   on first Fridays. A first date in a month's fifth week (the 29th to the 31st) repeats on each
//   month's last such weekday, since most months have no fifth one;
// - until: the last day it can happen on, on the Society's calendar, included. The first date
//   always counts.
// Plain functions with no server code, so pages, feeds and tests share them.
import { isoDate, societyInstant, societyWallClock, type WallClock } from "@/lib/society-time";

/** How long calendars show an event: events have a start but no end time (C-1's schema). */
export const EVENT_LENGTH_MS = 2 * 60 * 60 * 1000;

/** Which week of the month a monthly event keeps: the first to the fourth, or the last. */
export type WeekOfMonth = 1 | 2 | 3 | 4 | "last";

export type RepeatRule =
  | { frequency: "weekly"; until: string | null }
  | { frequency: "monthly"; until: string | null; week: WeekOfMonth; weekday: number };

/** When an event happens: its first (or only) start, and how it repeats. */
export type EventSchedule = { start: Date; repeat: RepeatRule | null };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** No window needs more dates of one event than this: a guard against a runaway loop. */
const MAX_OCCURRENCES = 1000;

/**
 * An event's schedule from its `start` and `recurrence` as Sanity stores them, or null if the
 * start isn't a date and time. A repeat with a last date that isn't a date (YYYY-MM-DD) counts as
 * no repeat. A repeat with no last date (only a draft can lack one) goes on without end.
 */
export function readSchedule(start: unknown, recurrence: unknown): EventSchedule | null {
  const first = typeof start === "string" ? new Date(start) : null;
  if (!first || Number.isNaN(first.getTime())) return null;
  const { frequency, until } = (recurrence ?? {}) as { frequency?: unknown; until?: unknown };
  if (frequency !== "weekly" && frequency !== "monthly") return { start: first, repeat: null };
  const lastDay = until === undefined || until === null ? null : until;
  if (lastDay !== null && !(typeof lastDay === "string" && isDate(lastDay))) {
    return { start: first, repeat: null };
  }
  if (frequency === "weekly") return { start: first, repeat: { frequency, until: lastDay } };
  const { day, weekday } = societyWallClock(first);
  const week = day > 28 ? "last" : (Math.ceil(day / 7) as 1 | 2 | 3 | 4);
  return { start: first, repeat: { frequency, until: lastDay, week, weekday } };
}

/**
 * The starts of each time the event happens from `from` (included) to `to` (excluded), earliest
 * first, and at most `limit` of them.
 */
export function occurrencesBetween(
  { start, repeat }: EventSchedule,
  from: Date,
  to: Date,
  limit = MAX_OCCURRENCES,
): Date[] {
  if (!repeat) return start >= from && start < to && limit > 0 ? [start] : [];
  const first = societyWallClock(start);
  const dateAt =
    repeat.frequency === "weekly"
      ? (index: number) => addDays(first, index * 7)
      : (index: number) => weekdayInMonth(first.year, first.month + index, repeat);
  // Start just before the window instead of walking from the first date. A week or a month back
  // covers the hour the clocks can shift between the first date and the window.
  const skip =
    repeat.frequency === "weekly"
      ? Math.floor((from.getTime() - start.getTime()) / WEEK_MS) - 1
      : monthsBetween(first, societyWallClock(from)) - 1;

  const found: Date[] = [];
  const cap = Math.min(limit, MAX_OCCURRENCES);
  for (let index = Math.max(0, skip); found.length < cap; index++) {
    const date = dateAt(index);
    if (index > 0 && repeat.until !== null && isoDate(date) > repeat.until) break;
    // The first date is the start itself, to the second, even in the hour that happens twice.
    const instant =
      index === 0 ? start : societyInstant({ ...date, hour: first.hour, minute: first.minute });
    if (instant >= to) break;
    if (instant >= from) found.push(instant);
  }
  return found;
}

/**
 * The next `limit` times the event happens that haven't ended at `now` (an event lasts
 * EVENT_LENGTH_MS), earliest first: one in progress counts.
 */
export function upcomingOccurrences(schedule: EventSchedule, now: Date, limit: number): Date[] {
  const from = new Date(now.getTime() - EVENT_LENGTH_MS + 1);
  return occurrencesBetween(schedule, from, new Date(8.64e15), limit);
}

type CalendarDate = Pick<WallClock, "year" | "month" | "day">;

function isDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** `days` days after `date` (calendar arithmetic, so no clock change gets in the way). */
function addDays({ year, month, day }: CalendarDate, days: number): CalendarDate {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Whole months from `a`'s month to `b`'s (negative if `b` is earlier). */
function monthsBetween(a: CalendarDate, b: CalendarDate): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** The monthly rule's day in a month (`month` may run past 12: month 13 is next January). */
function weekdayInMonth(
  year: number,
  month: number,
  { week, weekday }: { week: WeekOfMonth; weekday: number },
): CalendarDate {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  if (week === "last") {
    const last = new Date(Date.UTC(y, m, 0));
    return { year: y, month: m, day: last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7) };
  }
  return { year: y, month: m, day: 1 + ((weekday - first.getUTCDay() + 7) % 7) + (week - 1) * 7 };
}
