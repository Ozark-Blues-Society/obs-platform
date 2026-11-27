import { describe, expect, it } from "vitest";
import { calendarWeeks, societyDay } from "./month-grid";

describe("calendarWeeks", () => {
  it("lays out a month in weeks from Sunday, blank outside the month", () => {
    // November 2026 starts on a Sunday and has 30 days: five weeks, the last with two days.
    const november = calendarWeeks("2026-11");
    expect(november).toHaveLength(5);
    expect(november[0]).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    expect(november[4]).toEqual(["2026-11-29", "2026-11-30", null, null, null, null, null]);
    // December 2026 starts on a Tuesday.
    expect(calendarWeeks("2026-12")[0].slice(0, 3)).toEqual([null, null, "2026-12-01"]);
    // February 2026 starts on a Sunday and has 28 days: exactly four weeks.
    expect(calendarWeeks("2026-02")).toHaveLength(4);
    // May 2027 starts on a Saturday and has 31 days: six weeks.
    expect(calendarWeeks("2027-05")).toHaveLength(6);
  });

  it("refuses what isn't a month", () => {
    expect(() => calendarWeeks("2026-13")).toThrow('Not a month: "2026-13"');
  });
});

describe("societyDay", () => {
  it("dates an event by the Society's calendar", () => {
    // 8 PM on November 30 in Central Time is December 1 in UTC.
    expect(societyDay("2026-12-01T02:00:00.000Z")).toBe("2026-11-30");
    expect(societyDay("2026-12-01T06:00:00.000Z")).toBe("2026-12-01");
  });
});
