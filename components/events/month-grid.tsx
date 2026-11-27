import Link from "next/link";
import { LockIcon } from "@/components/ui/lock-icon";
import { cx } from "@/lib/cx";
import type { EventOccurrence } from "@/lib/events/load";
import { calendarWeeks, societyDay } from "@/lib/events/month-grid";

const WEEKDAYS = [
  ["Sun", "Sunday"],
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
] as const;

type MonthGridProps = {
  /** The month, written "2026-11". */
  month: string;
  /** The id of the heading that names the month, which names the table too. */
  labelledBy: string;
  /** Today on the Society's calendar (YYYY-MM-DD), marked in the grid. */
  today: string;
  /** The month's event dates to show, earliest first. */
  dates: readonly EventOccurrence[];
};

/**
 * The month view (the approved concept's calendar): a table of the month's weeks, each day with
 * its events as links to their pages. Members-only events carry a lock and repeating ones a grey
 * chip. On a phone the chips shrink to colored bars, as in the concept; the list beside the grid
 * names them.
 */
export function MonthGrid({ month, labelledBy, today, dates }: MonthGridProps) {
  const byDay = new Map<string, EventOccurrence[]>();
  for (const date of dates) {
    const day = societyDay(date.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), date]);
  }

  return (
    <table aria-labelledby={labelledBy} className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          {WEEKDAYS.map(([short, long]) => (
            <th
              key={short}
              scope="col"
              className="border-b border-line p-1 text-left text-tag text-muted uppercase sm:p-2"
            >
              <span aria-hidden="true">{short}</span>
              <span className="sr-only">{long}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {calendarWeeks(month).map((week, row) => (
          <tr key={row}>
            {week.map((day, column) =>
              day ? (
                <td
                  key={day}
                  aria-current={day === today ? "date" : undefined}
                  className="h-16 border-r border-b border-line p-0.75 align-top last:border-r-0 sm:h-24 sm:p-1.5"
                >
                  <span
                    className={cx(
                      "inline-block min-w-5 rounded-full text-center text-small font-semibold",
                      day === today ? "bg-primary text-white" : "text-muted",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {byDay.has(day) && (
                    // A column that can shrink, so a long title ends in "…" inside its day.
                    <ul className="mt-0.5 grid grid-cols-1 gap-0.75">
                      {byDay.get(day)!.map((date) => (
                        <li key={date.key} className="min-w-0">
                          <Chip date={date} />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              ) : (
                <td
                  key={`blank-${column}`}
                  className="border-r border-b border-line bg-canvas last:border-r-0"
                />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Chip({ date }: { date: EventOccurrence }) {
  return (
    <Link
      href={date.href}
      // A month can hold dozens of chips: prefetching every event page would cost more than it saves.
      prefetch={false}
      title={date.title}
      // Named in one string: Chrome puts a space between a flex link's parts (", members only").
      aria-label={date.membersOnly ? `${date.title}, members only` : undefined}
      className={cx(
        "flex items-center gap-1 overflow-hidden rounded-sm px-1.5 py-0.75 text-tag leading-tight font-normal tracking-normal whitespace-nowrap no-underline",
        "max-sm:h-1.5 max-sm:p-0",
        date.membersOnly
          ? "bg-accent-soft text-accent-dark"
          : date.repeats
            ? "bg-muted-soft text-muted"
            : "bg-primary-soft text-primary",
        // Forced colors drop backgrounds: keep each bar visible as an outline.
        "forced-colors:border forced-colors:border-[LinkText]",
      )}
    >
      {date.membersOnly && <LockIcon className="size-3 flex-none max-sm:hidden" />}
      <span className="min-w-0 truncate max-sm:sr-only">{date.title}</span>
    </Link>
  );
}
