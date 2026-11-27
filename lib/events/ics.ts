// Calendar files (iCalendar, RFC 5545) for "Add to calendar" and the calendar feed (backlog P-2).
// Each event is one VEVENT in the Society's time zone, with its repeats as an RRULE, so calendar
// apps keep a 7 PM jam at 7 PM across clock changes and agree with the site's calendar
// (./occurrences.ts): weekly, or monthly on the nth (or last) weekday, until the end of the last
// date in Central Time. Plain functions, so the routes and tests share them.
import { societyInstant, societyWallClock, type WallClock } from "@/lib/society-time";
import { SOCIETY_TIME_ZONE } from "@/sanity/schemas/options";
import { EVENT_LENGTH_MS, type EventSchedule } from "./occurrences";

/** One event in a calendar file. */
export type CalendarEntry = {
  /** The same for the event in every file, so a calendar app updates it instead of adding another. */
  uid: string;
  title: string;
  schedule: EventSchedule;
  /** The event page. */
  url: string;
  location?: string | null;
  description?: string | null;
  category?: string | null;
  /** When the event was last changed. */
  updatedAt?: Date | null;
};

export type CalendarFile = {
  /**
   * For a feed: what calendar apps call the subscribed calendar. Leave it out for one event to
   * add, or some apps open the file as a calendar of its own.
   */
  name?: string;
  entries: readonly CalendarEntry[];
  /** When the file is made (DTSTAMP). */
  now: Date;
  /** For a feed: how often subscribers should check for changes, in hours. */
  refreshHours?: number;
};

// The US rules since 2007, which calendar apps need to place times written in Central Time.
const TIME_ZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${SOCIETY_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The calendar file, with CRLF line ends and long lines folded, as RFC 5545 requires. */
export function calendarFile({ name, entries, now, refreshHours }: CalendarFile): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ozark Blues Society//Events calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(name ? [`X-WR-CALNAME:${text(name)}`, `X-WR-TIMEZONE:${SOCIETY_TIME_ZONE}`] : []),
    ...(refreshHours
      ? [`REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`, `X-PUBLISHED-TTL:PT${refreshHours}H`]
      : []),
    ...TIME_ZONE,
    ...entries.flatMap((entry) => eventLines(entry, now)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function eventLines(entry: CalendarEntry, now: Date): string[] {
  const { start, repeat } = entry.schedule;
  const end = new Date(start.getTime() + EVENT_LENGTH_MS);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${text(entry.uid)}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART;TZID=${SOCIETY_TIME_ZONE}:${local(societyWallClock(start))}`,
    `DTEND;TZID=${SOCIETY_TIME_ZONE}:${local(societyWallClock(end))}`,
  ];
  if (repeat) {
    const rule =
      repeat.frequency === "weekly"
        ? "FREQ=WEEKLY"
        : `FREQ=MONTHLY;BYDAY=${repeat.week === "last" ? -1 : repeat.week}${WEEKDAYS[repeat.weekday]}`;
    lines.push(`RRULE:${rule}${repeat.until ? `;UNTIL=${endOfDay(repeat.until)}` : ""}`);
  }
  lines.push(`SUMMARY:${text(entry.title)}`, `URL:${entry.url}`);
  if (entry.location) lines.push(`LOCATION:${text(entry.location)}`);
  if (entry.description) lines.push(`DESCRIPTION:${text(entry.description)}`);
  if (entry.category) lines.push(`CATEGORIES:${text(entry.category)}`);
  if (entry.updatedAt && !Number.isNaN(entry.updatedAt.getTime())) {
    lines.push(`LAST-MODIFIED:${utc(entry.updatedAt)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** A date and time on the Society's clocks: 20261204T200000. */
function local({ year, month, day, hour, minute }: WallClock): string {
  return `${pad(year, 4)}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
}

/** An instant in UTC: 20261205T020000Z. */
function utc(instant: Date): string {
  return `${instant.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** The last minute of a date (YYYY-MM-DD) on the Society's calendar, in UTC, for UNTIL. */
function endOfDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return utc(societyInstant({ year, month, day, hour: 23, minute: 59 }));
}

/** A TEXT value: backslashes, semicolons, commas and line breaks escaped. */
function text(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * A content line folded into lines of at most 75 bytes, each continuation starting with a space.
 * Never splits a character.
 */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // A continuation's leading space counts toward its 75 bytes.
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}
