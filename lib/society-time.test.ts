import { describe, expect, it } from "vitest";
import { eventDateParts, formatSocietyDate } from "./society-time";

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
});
