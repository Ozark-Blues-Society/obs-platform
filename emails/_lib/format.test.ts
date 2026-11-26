// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, levelName, siteLink } from "./format";

describe("formatDate", () => {
  it("shows a timestamp's day in the Society's time zone (Central)", () => {
    // 03:30 UTC on Nov 27 is still the evening of Nov 26 in the Ozarks.
    expect(formatDate("2026-11-27T03:30:00Z")).toBe("November 26, 2026");
    expect(formatDate("2026-11-27T06:30:00Z")).toBe("November 27, 2026");
  });

  it("reads timestamps as the database returns them", () => {
    expect(formatDate("2027-11-26T15:04:05.123456+00:00")).toBe("November 26, 2027");
  });

  it("shows a plain date as that day, whatever the time zone", () => {
    expect(formatDate("2026-12-01")).toBe("December 1, 2026");
  });

  it("refuses what isn't a date, rather than sending 'Invalid Date'", () => {
    expect(() => formatDate("next year")).toThrow('Not a date: "next year"');
    expect(() => formatDate("")).toThrow();
  });
});

describe("formatAmount", () => {
  it("formats cents as dollars", () => {
    expect(formatAmount(3000)).toBe("$30.00");
    expect(formatAmount(50000)).toBe("$500.00");
    expect(formatAmount(1999)).toBe("$19.99");
    expect(formatAmount(0)).toBe("$0.00");
  });

  it("refuses amounts that aren't whole, positive cents", () => {
    expect(() => formatAmount(49.5)).toThrow("Not an amount in cents: 49.5");
    expect(() => formatAmount(-100)).toThrow();
    expect(() => formatAmount(Number.NaN)).toThrow();
  });
});

describe("levelName", () => {
  it("names each level as the board does", () => {
    expect(
      (["individual", "band", "business", "sponsor"] as const).map((level) => levelName(level)),
    ).toEqual(["Individual", "Band", "Business", "Sponsor"]);
  });
});

describe("siteLink", () => {
  it("makes absolute links, with or without a trailing slash on the site's address", () => {
    expect(siteLink("https://example.org", "/account")).toBe("https://example.org/account");
    expect(siteLink("https://example.org/", "/account")).toBe("https://example.org/account");
    expect(siteLink("http://localhost:3000", "/")).toBe("http://localhost:3000/");
  });

  it("refuses a site address that isn't absolute", () => {
    expect(() => siteLink("example.org", "/account")).toThrow();
  });
});
