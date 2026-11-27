// The month view's grid (backlog P-2): the month's days in weeks from Sunday, as the approved
// concept draws it, and the Society's calendar date of each event date. Plain functions, so the
// calendar's client component and the tests share them.
import { isMonth, isoDate, societyWallClock } from "@/lib/society-time";

/**
 * The month (written "2026-11") as weeks of seven days, Sunday first: each day as YYYY-MM-DD, and
 * null for the days before the 1st and after the last, which belong to other months.
 */
export function calendarWeeks(month: string): (string | null)[][] {
  if (!isMonth(month)) throw new Error(`Not a month: "${month}"`);
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, cell) => {
    const day = cell - first + 1;
    return day >= 1 && day <= days ? isoDate({ year, month: index, day }) : null;
  });
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** The day an event date (an ISO 8601 instant) falls on in the Society's calendar: YYYY-MM-DD. */
export function societyDay(instant: string): string {
  return isoDate(societyWallClock(new Date(instant)));
}
