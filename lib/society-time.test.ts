import { describe, expect, it } from "vitest";
import {
  addMonths,
  eventDateParts,
  formatSocietyDate,
  isMonth,
  monthName,
  monthRange,
  societyMonth,
} from "./society-time";

describe("Society time", () => {
  it("shows an instant on the Society's calendar (Central Time), not the server's", () => {
    // 02:00 UTC on Dec 5 is 8 PM on Dec 4 in Central Standard Time (UTC-6).
    expect(eventDateParts("2026-12-05T02:00:00Z")).toEqual({
      iso: "2026-12-05T02:00:00.000Z",
      month: "Dec",
      day: "4",
      time: "8:00\u00a0PM", // joined by a no-break space
    });
    // Central Daylight Time (UTC-5) in summer.
    expect(eventDateParts(new Date("2026-07-01T04:30:00Z"))).toMatchObject({
      month: "Jun",
      day: "30",
      time: "11:30\u00a0PM",
    });
  });

  it("formats a meta-line date with the year", () => {
    expect(formatSocietyDate("2026-10-14T15:00:00Z")).toBe("Oct 14, 2026");
    expect(formatSocietyDate("2027-01-01T03:00:00Z")).toBe("Dec 31, 2026");
  });

  it("reads a month as the Society writes it", () => {
    expect(["2026-11", "2027-01", "1999-12"].every(isMonth)).toBe(true);
    for (const value of [
      "2026-13",
      "2026-00",
      "2026-1",
      "26-11",
      "2026-11-01",
      " 2026-11",
      202611,
    ]) {
      expect(isMonth(value), String(value)).toBe(false);
    }
    expect(monthName("2026-11")).toBe("November 2026");
    expect(() => monthName("2026-13")).toThrow('Not a month: "2026-13"');
  });

  it("finds the month an instant falls in on the Society's calendar", () => {
    // 03:00 UTC on Dec 1 is still 9 PM on Nov 30 in Central Standard Time.
    expect(societyMonth(new Date("2026-12-01T03:00:00Z"))).toBe("2026-11");
    expect(societyMonth(new Date("2026-12-01T06:00:00Z"))).toBe("2026-12");
    expect(societyMonth(new Date("2027-01-01T05:59:59Z"))).toBe("2026-12");
  });

  it("counts months across years", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", -11)).toBe("2025-12");
  });

  it("starts and ends a month at midnight Central Time, daylight saving or not", () => {
    // November 2026 starts in daylight saving time (UTC-5), which ends at 2 AM that day, and
    // ends in standard time (UTC-6).
    expect(monthRange("2026-11")).toEqual({
      start: new Date("2026-11-01T05:00:00Z"),
      end: new Date("2026-12-01T06:00:00Z"),
    });
    // Daylight saving time starts on March 8, 2026, after March's first midnight.
    expect(monthRange("2026-03")).toEqual({
      start: new Date("2026-03-01T06:00:00Z"),
      end: new Date("2026-04-01T05:00:00Z"),
    });
    expect(monthRange("2026-12").end).toEqual(new Date("2027-01-01T06:00:00Z"));
    // The month each boundary starts, by the Society's clock.
    const { start, end } = monthRange("2026-11");
    expect(societyMonth(start)).toBe("2026-11");
    expect(societyMonth(new Date(start.getTime() - 1000))).toBe("2026-10");
    expect(societyMonth(new Date(end.getTime() - 1000))).toBe("2026-11");
    expect(societyMonth(end)).toBe("2026-12");
  });
});
