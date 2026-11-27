import { describe, expect, it } from "vitest";
import { calendarHref, isCategoryFilter, readCalendarParams } from "./calendar-params";

// 9 AM on November 27, 2026 in Central Time.
const NOW = new Date("2026-11-27T15:00:00Z");

describe("readCalendarParams", () => {
  it("reads the month, view and category from the address", () => {
    expect(readCalendarParams({ month: "2027-03", view: "list", category: "jam" }, NOW)).toEqual({
      month: "2027-03",
      view: "list",
      category: "jam",
    });
    expect(readCalendarParams({ month: ["2027-04", "2027-05"] }, NOW).month).toBe("2027-04");
  });

  it("falls back to this month, the grid and every category", () => {
    const defaults = { month: "2026-11", view: "month", category: "all" };
    expect(readCalendarParams({}, NOW)).toEqual(defaults);
    expect(readCalendarParams({ month: "2026-13", view: "agenda", category: "Jam" }, NOW)).toEqual(
      defaults,
    );
    // 11 PM on November 30 in Central Time is already December in UTC.
    expect(readCalendarParams({}, new Date("2026-12-01T05:00:00Z")).month).toBe("2026-11");
  });
});

describe("calendarHref and isCategoryFilter", () => {
  it("leaves the defaults out of the address", () => {
    expect(calendarHref("2026-12", "month", "all")).toBe("/events?month=2026-12");
    expect(calendarHref("2026-12", "list", "society")).toBe(
      "/events?month=2026-12&view=list&category=society",
    );
  });

  it("knows the categories", () => {
    expect(["all", "concert", "jam", "workshop", "society"].every(isCategoryFilter)).toBe(true);
    expect(isCategoryFilter("Jam")).toBe(false);
    expect(isCategoryFilter(undefined)).toBe(false);
  });
});
