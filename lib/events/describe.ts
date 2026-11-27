// How the event page says when a repeating event happens: "Every Tuesday", "First Friday of every
// month", with ./occurrences.ts's rules.
import { societyWallClock } from "@/lib/society-time";
import type { EventSchedule } from "./occurrences";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKS = { 1: "First", 2: "Second", 3: "Third", 4: "Fourth", last: "Last" } as const;

/** "Every Tuesday" or "Last Friday of every month"; null for an event that doesn't repeat. */
export function repeatText({ start, repeat }: EventSchedule): string | null {
  if (!repeat) return null;
  if (repeat.frequency === "monthly") {
    return `${WEEKS[repeat.week]} ${DAYS[repeat.weekday]} of every month`;
  }
  return `Every ${DAYS[societyWallClock(start).weekday]}`;
}
