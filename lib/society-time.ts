// Dates and times as the Society shows them: in its own time zone (Central Time), whatever the
// time zone of the server or the visitor's device.
import { SOCIETY_TIME_ZONE } from "@/sanity/schemas/options";

const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: SOCIETY_TIME_ZONE });

const monthFormat = format({ month: "short" });
const dayFormat = format({ day: "numeric" });
const timeFormat = format({ hour: "numeric", minute: "2-digit" });
const dateFormat = format({ month: "short", day: "numeric", year: "numeric" });

// "8:00 PM" joined by a no-break space, so a narrow card never splits it across two lines. ICU
// versions differ here (some put a narrow no-break space, which `\s` also matches), so this also
// keeps the server's and the browser's output identical.
const NO_BREAK_SPACE = "\u00a0";
const joinMeridiem = (time: string) => time.replace(/\s+(?=[AP]M$)/, NO_BREAK_SPACE);

/** An event's start for its date badge: { month: "Dec", day: "4", time: "8:00 PM" }. */
export function eventDateParts(instant: string | Date) {
  const date = new Date(instant);
  return {
    /** For a `<time dateTime>` attribute. */
    iso: date.toISOString(),
    month: monthFormat.format(date),
    day: dayFormat.format(date),
    time: joinMeridiem(timeFormat.format(date)),
  };
}

/** A date for a meta line, such as a post's: "Oct 14, 2026". */
export function formatSocietyDate(instant: string | Date): string {
  return dateFormat.format(new Date(instant));
}

const isoDateFormat = format({ year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * The date (YYYY-MM-DD) that `instant` falls on in the Society's time zone, as Sanity stores date
 * fields such as a sponsorship's last day, or undefined for an invalid date.
 */
export function dateInSocietyTimeZone(instant: string | Date): string | undefined {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = isoDateFormat.formatToParts(date);
  const part = (type: string) => parts.find((each) => each.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Months on the Society's calendar, written "2026-11", such as the monthly email digest's
// (backlog E-4).
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Whether `value` is a month written as "2026-11". */
export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

function monthParts(month: string): { year: number; index: number } {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`Not a month: "${month}"`);
  return { year: Number(match[1]), index: Number(match[2]) - 1 };
}

const yearMonthFormat = format({ year: "numeric", month: "2-digit" });

/** The month that `instant` falls in on the Society's calendar: "2026-11". */
export function societyMonth(instant: Date): string {
  const parts = yearMonthFormat.formatToParts(instant);
  const part = (type: string) => parts.find((each) => each.type === type)?.value;
  return `${part("year")}-${part("month")}`;
}

/** The month `count` months after `month` (before it, for a negative count). */
export function addMonths(month: string, count: number): string {
  const { year, index } = monthParts(month);
  const first = new Date(Date.UTC(year, index + count, 1));
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "November 2026". */
export function monthName(month: string): string {
  const { year, index } = monthParts(month);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, index, 1)));
}

/**
 * When `month` starts and ends on the Society's calendar: midnight Central Time on its first day,
 * and on the next month's first day (the end is outside the month).
 */
export function monthRange(month: string): { start: Date; end: Date } {
  return { start: startOfMonth(month), end: startOfMonth(addMonths(month, 1)) };
}

const wallClockFormat = format({
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

/** How far the Society's clocks are ahead of UTC at `instant`, in milliseconds (negative: behind). */
function offsetAt(instant: number): number {
  const seconds = Math.floor(instant / 1000) * 1000;
  const parts = Object.fromEntries(
    wallClockFormat.formatToParts(new Date(seconds)).map((part) => [part.type, Number(part.value)]),
  );
  const wallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallClock - seconds;
}

/** Midnight Central Time at the start of the month's first day. */
function startOfMonth(month: string): Date {
  const { year, index } = monthParts(month);
  const midnight = Date.UTC(year, index, 1);
  // Midnight UTC comes 5 or 6 hours before the Society's. Guess with the offset then, and correct
  // with the offset at the guess, in case the clocks changed in between (in Central Time they
  // change at 2 AM, so they never do).
  const guess = midnight - offsetAt(midnight);
  return new Date(midnight - offsetAt(guess));
}
