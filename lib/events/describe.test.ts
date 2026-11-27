import { describe, expect, it } from "vitest";
import { repeatText } from "./describe";
import { readSchedule } from "./occurrences";

const textFor = (start: string, frequency: string) =>
  repeatText(readSchedule(start, { frequency, until: "2027-06-30" })!);

describe("repeatText", () => {
  it("names the weekday, and the week for a monthly event, on the Society's calendar", () => {
    // 8 PM on Friday, December 4 in Central Time is Saturday the 5th in UTC.
    expect(textFor("2026-12-05T02:00:00Z", "weekly")).toBe("Every Friday");
    expect(textFor("2026-12-05T02:00:00Z", "monthly")).toBe("First Friday of every month");
    expect(textFor("2026-11-26T18:00:00Z", "monthly")).toBe("Fourth Thursday of every month");
    expect(textFor("2026-10-30T18:00:00Z", "monthly")).toBe("Last Friday of every month");
  });

  it("says nothing for an event that doesn't repeat", () => {
    expect(textFor("2026-12-05T02:00:00Z", "none")).toBeNull();
  });
});
