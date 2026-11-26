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
