import { describe, expect, it } from "vitest";
import { calendarFile, type CalendarEntry } from "./ics";
import { readSchedule } from "./occurrences";

const NOW = new Date("2026-11-27T17:00:00Z");

function entry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    uid: "fixture-event-delta-night@ozarkblues.example",
    title: "Delta Night: The Mavis Crane Band",
    // 8 PM on Friday, December 4 in Central Time.
    schedule: readSchedule("2026-12-05T02:00:00Z", { frequency: "none" })!,
    url: "https://ozarkblues.example/events/delta-night",
    ...overrides,
  };
}

const lines = (file: string) => file.replace(/\r\n /g, "").split("\r\n");

/** The lines of the only VEVENT, unfolded. */
const eventOf = (file: string) => {
  const all = lines(file);
  return all.slice(all.indexOf("BEGIN:VEVENT"), all.indexOf("END:VEVENT") + 1);
};

describe("calendarFile", () => {
  it("writes an event in Central Time, two hours long, with the Society's time zone", () => {
    const file = calendarFile({
      name: "Ozark Blues Society events",
      entries: [
        entry({
          location: "Old Mill Music Hall, 410 Mill Street, Riverbend",
          description: "$15 · Members $10",
          category: "Concert",
          updatedAt: new Date("2026-11-20T10:00:00Z"),
        }),
      ],
      now: NOW,
    });
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    const all = lines(file);
    expect(all.slice(0, 7)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ozark Blues Society//Events calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Ozark Blues Society events",
      "X-WR-TIMEZONE:America/Chicago",
    ]);
    expect(all.filter((line) => line === "BEGIN:VTIMEZONE")).toHaveLength(1);
    expect(all).toContain("RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU");
    expect(all.some((line) => line.startsWith("REFRESH-INTERVAL"))).toBe(false);
    expect(eventOf(file)).toEqual([
      "BEGIN:VEVENT",
      "UID:fixture-event-delta-night@ozarkblues.example",
      "DTSTAMP:20261127T170000Z",
      "DTSTART;TZID=America/Chicago:20261204T200000",
      "DTEND;TZID=America/Chicago:20261204T220000",
      "SUMMARY:Delta Night: The Mavis Crane Band",
      "URL:https://ozarkblues.example/events/delta-night",
      "LOCATION:Old Mill Music Hall\\, 410 Mill Street\\, Riverbend",
      "DESCRIPTION:$15 · Members $10",
      "CATEGORIES:Concert",
      "LAST-MODIFIED:20261120T100000Z",
      "END:VEVENT",
    ]);
  });

  it("repeats weekly or monthly as the site does, until the end of the last date", () => {
    const weekly = calendarFile({
      entries: [
        entry({
          schedule: readSchedule("2026-12-02T02:00:00Z", {
            frequency: "weekly",
            until: "2026-12-15",
          })!,
        }),
      ],
      now: NOW,
    });
    // 11:59 PM on December 15 in Central Standard Time is 05:59 UTC on the 16th.
    expect(eventOf(weekly)).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261216T055900Z");

    const firstFriday = readSchedule("2026-12-05T02:00:00Z", {
      frequency: "monthly",
      until: "2027-06-30",
    })!;
    const lastFriday = readSchedule("2026-10-30T18:00:00Z", { frequency: "monthly" })!;
    const monthly = calendarFile({
      entries: [entry({ schedule: firstFriday }), entry({ uid: "b", schedule: lastFriday })],
      now: NOW,
    });
    const rules = lines(monthly).filter((line) => line.startsWith("RRULE:FREQ=MONTHLY"));
    // June 30, 2027 ends in daylight time: 04:59 UTC on July 1.
    expect(rules).toEqual([
      "RRULE:FREQ=MONTHLY;BYDAY=1FR;UNTIL=20270701T045900Z",
      "RRULE:FREQ=MONTHLY;BYDAY=-1FR",
    ]);
  });

  it("escapes text and folds long lines at 75 bytes without splitting a character", () => {
    const description = `Doors at 7; music at 8, "rain or shine".\nBring a chair \\ a blanket. ${"Blues é ".repeat(20)}`;
    const file = calendarFile({
      entries: [entry({ title: "Jam; open, all levels", description })],
      now: NOW,
    });
    const physical = file.split("\r\n");
    for (const line of physical) {
      expect(new TextEncoder().encode(line).length, line).toBeLessThanOrEqual(75);
    }
    expect(physical.some((line) => line.startsWith(" "))).toBe(true);
    // One event to add has no calendar name, so apps add it to a calendar instead of opening one.
    expect(file).not.toContain("X-WR-");
    expect(file).not.toContain("�");
    const unfolded = eventOf(file);
    expect(unfolded).toContain("SUMMARY:Jam\\; open\\, all levels");
    expect(unfolded).toContain(
      `DESCRIPTION:Doors at 7\\; music at 8\\, "rain or shine".\\nBring a chair \\\\ a blanket. ${"Blues é ".repeat(20)}`,
    );
  });

  it("tells a feed's subscribers how often to check", () => {
    const file = calendarFile({ name: "Events", entries: [], now: NOW, refreshHours: 6 });
    expect(lines(file)).toEqual(
      expect.arrayContaining(["REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"]),
    );
    expect(lines(file)).not.toContain("BEGIN:VEVENT");
  });
});
