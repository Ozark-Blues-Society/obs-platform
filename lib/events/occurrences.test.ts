import { describe, expect, it } from "vitest";
import { monthRange } from "@/lib/society-time";
import {
  EVENT_LENGTH_MS,
  occurrencesBetween,
  readSchedule,
  upcomingOccurrences,
  type EventSchedule,
} from "./occurrences";

// Dates below are in 2026 and 2027, in Central Time (the Society's). Daylight saving time starts
// at 2 AM on March 8, 2026 (UTC-6 to UTC-5) and ends at 2 AM on November 1, 2026.

function schedule(start: string, frequency = "none", until?: string): EventSchedule {
  const read = readSchedule(start, { frequency, until });
  if (!read) throw new Error(`not a schedule: ${start}`);
  return read;
}

const between = (event: EventSchedule, from: string, to: string, limit?: number) =>
  occurrencesBetween(event, new Date(from), new Date(to), limit).map((date) => date.toISOString());

/** Every date in a month on the Society's calendar, written "2026-11". */
const inMonth = (event: EventSchedule, month: string) => {
  const { start, end } = monthRange(month);
  return between(event, start.toISOString(), end.toISOString());
};

describe("readSchedule", () => {
  it("reads a one-off event", () => {
    expect(readSchedule("2026-12-05T02:00:00Z", { frequency: "none" })).toEqual({
      start: new Date("2026-12-05T02:00:00Z"),
      repeat: null,
    });
    expect(readSchedule("2026-12-05T02:00:00Z", undefined)?.repeat).toBeNull();
  });

  it("keeps a monthly event's weekday and week, on the Society's calendar", () => {
    // 8 PM on Friday, December 4 in Central Time is 02:00 UTC on Saturday the 5th.
    expect(
      readSchedule("2026-12-05T02:00:00Z", { frequency: "monthly", until: "2027-06-30" }),
    ).toMatchObject({ repeat: { frequency: "monthly", week: 1, weekday: 5, until: "2027-06-30" } });
    // November 26 is the fourth Thursday; October 30 is in the fifth week, so it's the last Friday.
    expect(readSchedule("2026-11-26T18:00:00Z", { frequency: "monthly" })?.repeat).toMatchObject({
      week: 4,
      weekday: 4,
      until: null,
    });
    expect(readSchedule("2026-10-30T18:00:00Z", { frequency: "monthly" })?.repeat).toMatchObject({
      week: "last",
      weekday: 5,
    });
  });

  it("refuses a start that isn't a date and time, and a last date that isn't a date", () => {
    for (const start of [undefined, null, "", "soon", 1764900000000]) {
      expect(readSchedule(start, { frequency: "weekly" })).toBeNull();
    }
    for (const until of ["2027-02-30", "2027-1-5", "next year", 20270105]) {
      expect(
        readSchedule("2026-12-05T02:00:00Z", { frequency: "weekly", until })?.repeat,
      ).toBeNull();
    }
    expect(readSchedule("2026-12-05T02:00:00Z", { frequency: "daily" })?.repeat).toBeNull();
  });
});

describe("occurrencesBetween", () => {
  it("finds a one-off event in its window: start included, end excluded", () => {
    const event = schedule("2026-12-05T02:00:00Z");
    expect(between(event, "2026-12-05T02:00:00Z", "2026-12-06T00:00:00Z")).toEqual([
      "2026-12-05T02:00:00.000Z",
    ]);
    expect(between(event, "2026-12-01T00:00:00Z", "2026-12-05T02:00:00Z")).toEqual([]);
    expect(between(event, "2026-12-05T02:00:01Z", "2027-01-01T00:00:00Z")).toEqual([]);
  });

  it("puts a late event at month's end in its own month, by the Society's calendar", () => {
    // 11 PM on November 30 is already December 1 in UTC; midnight on December 1 is December's.
    const late = schedule("2026-12-01T05:00:00Z");
    const midnight = schedule("2026-12-01T06:00:00Z");
    expect(inMonth(late, "2026-11")).toEqual(["2026-12-01T05:00:00.000Z"]);
    expect(inMonth(late, "2026-12")).toEqual([]);
    expect(inMonth(midnight, "2026-11")).toEqual([]);
    expect(inMonth(midnight, "2026-12")).toEqual(["2026-12-01T06:00:00.000Z"]);
  });

  it("repeats a weekly event at the same local time when daylight saving time ends", () => {
    // Tuesdays at 7 PM: 00:00 UTC in daylight saving time, 01:00 UTC after it ends.
    const jam = schedule("2026-10-14T00:00:00Z", "weekly", "2026-11-30");
    expect(between(jam, "2026-10-20T00:00:00Z", "2026-11-12T00:00:00Z")).toEqual([
      "2026-10-21T00:00:00.000Z",
      "2026-10-28T00:00:00.000Z",
      "2026-11-04T01:00:00.000Z",
      "2026-11-11T01:00:00.000Z",
    ]);
  });

  it("repeats a weekly event at the same local time when daylight saving time starts", () => {
    const jam = schedule("2026-02-25T01:00:00Z", "weekly", "2026-03-31");
    expect(inMonth(jam, "2026-03")).toEqual([
      "2026-03-04T01:00:00.000Z",
      "2026-03-11T00:00:00.000Z",
      "2026-03-18T00:00:00.000Z",
      "2026-03-25T00:00:00.000Z",
      "2026-04-01T00:00:00.000Z", // Tuesday, March 31 at 7 PM
    ]);
  });

  it("moves a time the spring change skips an hour later, and takes the first of a repeated hour", () => {
    // Sundays at 2:30 AM: there's no 2:30 AM on March 8, so that week it's 3:30 AM.
    const early = schedule("2026-03-01T08:30:00Z", "weekly", "2026-03-15");
    expect(between(early, "2026-03-01T00:00:00Z", "2026-03-16T00:00:00Z")).toEqual([
      "2026-03-01T08:30:00.000Z",
      "2026-03-08T08:30:00.000Z", // 3:30 AM daylight time
      "2026-03-15T07:30:00.000Z",
    ]);
    // Sundays at 1:30 AM: on November 1 the hour from 1 AM happens twice; the first one counts.
    const late = schedule("2026-10-25T06:30:00Z", "weekly", "2026-11-08");
    expect(between(late, "2026-10-25T00:00:00Z", "2026-11-09T00:00:00Z")).toEqual([
      "2026-10-25T06:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
      "2026-11-08T07:30:00.000Z",
    ]);
  });

  it("includes the last date, by the Society's calendar, and nothing after it", () => {
    // Tuesdays at 8 PM, which is Wednesday 02:00 in UTC.
    const start = "2026-12-02T02:00:00Z";
    const window = ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"] as const;
    expect(between(schedule(start, "weekly", "2026-12-15"), ...window)).toEqual([
      "2026-12-02T02:00:00.000Z",
      "2026-12-09T02:00:00.000Z",
      "2026-12-16T02:00:00.000Z", // Tuesday, December 15 at 8 PM: the last date
    ]);
    expect(between(schedule(start, "weekly", "2026-12-14"), ...window)).toHaveLength(2);
    expect(between(schedule(start, "weekly", "2026-12-16"), ...window)).toHaveLength(3);
  });

  it("always counts the first date, even with a last date before it", () => {
    const event = schedule("2026-12-02T02:00:00Z", "weekly", "2026-11-30");
    expect(between(event, "2026-11-01T00:00:00Z", "2027-01-01T00:00:00Z")).toEqual([
      "2026-12-02T02:00:00.000Z",
    ]);
  });

  it("repeats without end when there's no last date yet, within the window", () => {
    const event = schedule("2026-12-02T02:00:00Z", "weekly");
    expect(inMonth(event, "2027-06")).toHaveLength(5);
  });

  it("repeats a monthly event on the same weekday and week, across years and clock changes", () => {
    // The first Friday at 7 PM: 01:00 UTC on Saturday in standard time, 00:00 in daylight time.
    const event = schedule("2026-12-05T01:00:00Z", "monthly", "2027-04-30");
    expect(between(event, "2026-12-01T00:00:00Z", "2027-06-01T00:00:00Z")).toEqual([
      "2026-12-05T01:00:00.000Z", // December 4
      "2027-01-02T01:00:00.000Z", // January 1
      "2027-02-06T01:00:00.000Z", // February 5
      "2027-03-06T01:00:00.000Z", // March 5, before daylight saving time starts on the 14th
      "2027-04-03T00:00:00.000Z", // April 2
    ]);
  });

  it("keeps the fourth week a fourth week, and the fifth the month's last", () => {
    // The fourth Thursday (November 26) stays fourth: December 24, not December 31.
    const fourth = schedule("2026-11-26T18:00:00Z", "monthly", "2027-02-28");
    expect(between(fourth, "2026-11-01T00:00:00Z", "2027-03-01T00:00:00Z")).toEqual([
      "2026-11-26T18:00:00.000Z",
      "2026-12-24T18:00:00.000Z",
      "2027-01-28T18:00:00.000Z",
      "2027-02-25T18:00:00.000Z",
    ]);
    // Saturday, January 31 is in the fifth week: the last Saturday of each month after it.
    const last = schedule("2026-01-31T18:00:00Z", "monthly", "2026-04-30");
    expect(between(last, "2026-01-01T00:00:00Z", "2026-05-01T00:00:00Z")).toEqual([
      "2026-01-31T18:00:00.000Z",
      "2026-02-28T18:00:00.000Z",
      "2026-03-28T17:00:00.000Z", // noon in daylight time
      "2026-04-25T17:00:00.000Z",
    ]);
  });

  it("skips ahead to a window long after the first date", () => {
    const weekly = schedule("2020-01-07T01:00:00Z", "weekly"); // Mondays at 7 PM since 2020
    expect(inMonth(weekly, "2027-03")).toEqual([
      "2027-03-02T01:00:00.000Z",
      "2027-03-09T01:00:00.000Z",
      "2027-03-16T00:00:00.000Z", // after daylight saving time starts on March 14
      "2027-03-23T00:00:00.000Z",
      "2027-03-30T00:00:00.000Z",
    ]);
    const monthly = schedule("2020-01-07T01:00:00Z", "monthly"); // the first Monday
    expect(inMonth(monthly, "2027-03")).toEqual(["2027-03-02T01:00:00.000Z"]);
    // A last date before the window ends it at once.
    expect(inMonth(schedule("2020-01-07T01:00:00Z", "weekly", "2026-12-31"), "2027-03")).toEqual(
      [],
    );
  });

  it("stops at the limit", () => {
    const event = schedule("2026-12-02T02:00:00Z", "weekly");
    expect(between(event, "2026-12-01T00:00:00Z", "2027-12-01T00:00:00Z", 2)).toEqual([
      "2026-12-02T02:00:00.000Z",
      "2026-12-09T02:00:00.000Z",
    ]);
    expect(between(event, "2026-12-01T00:00:00Z", "2027-12-01T00:00:00Z", 0)).toEqual([]);
    expect(
      between(schedule("2026-12-05T02:00:00Z"), "2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z", 0),
    ).toEqual([]);
  });
});

describe("upcomingOccurrences", () => {
  const jam = schedule("2026-12-02T02:00:00Z", "weekly", "2026-12-31");

  it("counts a date in progress, until the event's two hours are over", () => {
    const start = new Date("2026-12-09T02:00:00Z");
    const during = new Date(start.getTime() + EVENT_LENGTH_MS - 1);
    const after = new Date(start.getTime() + EVENT_LENGTH_MS);
    expect(upcomingOccurrences(jam, during, 1)).toEqual([start]);
    expect(upcomingOccurrences(jam, after, 1)).toEqual([new Date("2026-12-16T02:00:00Z")]);
  });

  it("finds nothing once the last date is over", () => {
    expect(upcomingOccurrences(jam, new Date("2027-01-01T00:00:00Z"), 3)).toEqual([]);
    expect(
      upcomingOccurrences(schedule("2026-12-05T02:00:00Z"), new Date("2026-12-06T00:00:00Z"), 3),
    ).toEqual([]);
  });
});
