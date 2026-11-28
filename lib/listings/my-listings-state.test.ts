// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOCIETY_TIME_ZONE } from "@/sanity/schemas/options";
import {
  isRenewable,
  listingStanding,
  notRenewedMessage,
  renewableFrom,
  standingSummary,
  standingText,
  type MyListing,
} from "./my-listings-state";

// 8 AM on November 27, 2026 in the Ozarks (Central Standard Time, UTC-6).
const NOW = new Date("2026-11-27T14:00:00Z");

const listing = (changes: Partial<MyListing> = {}): MyListing => ({
  id: "00000000-0000-4000-8940-000000000001",
  category: "gear",
  title: "Tweed-style amp",
  price: 650,
  status: "live",
  rejectReason: null,
  createdAt: "2026-10-01T15:00:00Z",
  expiresAt: "2026-12-02T18:00:00Z",
  ...changes,
});

describe("listingStanding", () => {
  it("knows a listing waiting for review, and a rejected one with its reason", () => {
    expect(listingStanding(listing({ status: "pending", expiresAt: null }), NOW)).toEqual({
      kind: "pending",
    });
    expect(
      listingStanding(
        listing({ status: "rejected", rejectReason: "Add a price.", expiresAt: null }),
        NOW,
      ),
    ).toEqual({ kind: "rejected", reason: "Add a price." });
  });

  it("can renew a live listing from 5 days before it comes down, on the Society's calendar", () => {
    // Noon on December 2 in the Ozarks: 5 days from November 27.
    expect(listingStanding(listing({ expiresAt: "2026-12-02T18:00:00Z" }), NOW)).toEqual({
      kind: "live",
      expiresAt: "2026-12-02T18:00:00Z",
      renewable: true,
      renewableFrom: "2026-11-27T06:00:00.000Z",
    });
    // 11:30 PM on December 2 in the Ozarks, though it's December 3 in UTC: still 5 days.
    expect(listingStanding(listing({ expiresAt: "2026-12-03T05:30:00Z" }), NOW)).toMatchObject({
      renewable: true,
    });
    // 12:30 AM on December 3 in the Ozarks: 6 days.
    expect(listingStanding(listing({ expiresAt: "2026-12-03T06:30:00Z" }), NOW)).toEqual({
      kind: "live",
      expiresAt: "2026-12-03T06:30:00Z",
      renewable: false,
      renewableFrom: "2026-11-28T06:00:00.000Z",
    });
  });

  it("counts a live listing past its end as come down, before the daily job marks it", () => {
    expect(listingStanding(listing({ expiresAt: "2026-11-27T13:59:00Z" }), NOW)).toEqual({
      kind: "expired",
      expiresAt: "2026-11-27T13:59:00Z",
    });
    expect(listingStanding(listing({ expiresAt: NOW.toISOString() }), NOW).kind).toBe("expired");
  });

  it("knows an expired listing and when it came down", () => {
    expect(
      listingStanding(listing({ status: "expired", expiresAt: "2026-11-02T18:00:00Z" }), NOW),
    ).toEqual({ kind: "expired", expiresAt: "2026-11-02T18:00:00Z" });
  });
});

describe("renewableFrom", () => {
  it("is midnight in the Ozarks, 5 days before the day the listing comes down", () => {
    expect(renewableFrom("2026-12-02T18:00:00Z")).toBe("2026-11-27T06:00:00.000Z");
    // A day that begins in daylight time (CDT, UTC-5) before the clocks go back on November 1.
    expect(renewableFrom("2026-11-03T18:00:00Z")).toBe("2026-10-29T05:00:00.000Z");
    // A day that begins in standard time before the clocks go forward on March 14, 2027.
    expect(renewableFrom("2027-03-17T17:00:00Z")).toBe("2027-03-12T06:00:00.000Z");
    // Across the end of a month.
    expect(renewableFrom("2027-03-02T18:00:00Z")).toBe("2027-02-25T06:00:00.000Z");
  });
});

describe("isRenewable", () => {
  it("is true for a listing in its last 5 days or come down, and nothing else", () => {
    const at = (changes: Partial<MyListing>) => isRenewable(listingStanding(listing(changes), NOW));
    expect(at({ expiresAt: "2026-12-02T18:00:00Z" })).toBe(true);
    expect(at({ status: "expired" })).toBe(true);
    expect(at({ expiresAt: "2026-12-20T18:00:00Z" })).toBe(false);
    expect(at({ status: "pending", expiresAt: null })).toBe(false);
    expect(at({ status: "rejected", expiresAt: null })).toBe(false);
  });
});

describe("standingText", () => {
  it("says how long a live listing runs, and when it can be renewed", () => {
    const renewable = listingStanding(listing({ expiresAt: "2026-12-02T18:00:00Z" }), NOW);
    const early = listingStanding(listing({ expiresAt: "2026-12-20T18:00:00Z" }), NOW);

    expect(standingText(renewable, true)).toEqual({
      label: "Live",
      detail: "On the classifieds until Dec 2, 2026. Renew it to keep it up for another 60 days.",
    });
    expect(standingText(early, true).detail).toBe(
      "On the classifieds until Dec 20, 2026. You can renew it from Dec 15, 2026.",
    );
    // Without a current membership there's no Renew, so no talk of renewing.
    expect(standingText(renewable, false).detail).toBe("On the classifieds until Dec 2, 2026.");
    expect(standingText(early, false).detail).toBe("On the classifieds until Dec 20, 2026.");
  });

  it("says when an expired listing came down, and how to put it back up", () => {
    const expired = listingStanding(
      listing({ status: "expired", expiresAt: "2026-11-02T18:00:00Z" }),
      NOW,
    );

    expect(standingText(expired, true)).toEqual({
      label: "Expired",
      detail: "Came down on Nov 2, 2026. Renew it to put it back up for 60 days.",
    });
    expect(standingText(expired, false).detail).toBe("Came down on Nov 2, 2026.");
    expect(standingText({ kind: "expired", expiresAt: null }, false).detail).toBe(
      "No longer on the classifieds.",
    );
  });

  it("says what waits for review and what wasn't approved, with the moderator's reason", () => {
    expect(standingText({ kind: "pending" }, true).label).toBe("Awaiting review");
    expect(standingText({ kind: "rejected", reason: "Add a price." }, true)).toEqual({
      label: "Not approved",
      detail: "The moderator's reason: Add a price.",
    });
    expect(standingText({ kind: "rejected", reason: null }, true).detail).toBe(
      "A moderator didn't approve it.",
    );
  });
});

describe("standingSummary", () => {
  it("puts each standing in a few words for My Account", () => {
    expect(standingSummary({ kind: "pending" })).toBe("Awaiting review");
    expect(standingSummary({ kind: "rejected", reason: "x" })).toBe("Not approved");
    expect(standingSummary(listingStanding(listing(), NOW))).toBe("Live, until Dec 2, 2026");
    expect(standingSummary({ kind: "expired", expiresAt: "2026-11-02T18:00:00Z" })).toBe(
      "Expired on Nov 2, 2026",
    );
  });
});

describe("notRenewedMessage", () => {
  it("says the listing is gone when the member has no such listing", () => {
    expect(notRenewedMessage(null, "current", NOW)).toBe(
      "That listing isn't in your listings any more.",
    );
  });

  it("asks a member whose membership isn't current to renew it or join first", () => {
    expect(notRenewedMessage(listing(), "renew", NOW)).toBe(
      "Your membership has ended. Renew it, then you can renew your listings.",
    );
    expect(notRenewedMessage(listing(), "join", NOW)).toContain("Join the Society");
  });

  it("explains a listing that can't be renewed as it stands", () => {
    expect(notRenewedMessage(listing({ status: "pending", expiresAt: null }), "current", NOW)).toBe(
      "“Tweed-style amp” is waiting for review, so there's nothing to renew yet.",
    );
    expect(
      notRenewedMessage(listing({ status: "rejected", expiresAt: null }), "current", NOW),
    ).toContain("wasn't approved, so it can't be renewed");
    expect(notRenewedMessage(listing({ expiresAt: "2027-01-26T18:00:00Z" }), "current", NOW)).toBe(
      "“Tweed-style amp” is on the classifieds until Jan 26, 2027. You can renew it from Jan 21, 2027.",
    );
  });

  it("falls back to trying again when the listing could have been renewed", () => {
    expect(notRenewedMessage(listing(), "current", NOW)).toBe(
      "That didn't work. Please try again in a few minutes.",
    );
  });
});

describe("the database's calendar", () => {
  it("counts the listing days in the Society's time zone, the one the page shows dates in", () => {
    const zones = new Set(
      ["20261127221430_listing_expiry.sql", "20261127223233_listing_renewal.sql"].flatMap((file) =>
        [
          ...readFileSync(
            new URL(`../../supabase/migrations/${file}`, import.meta.url),
            "utf8",
          ).matchAll(/at time zone '([^']+)'/g),
        ].map(([, zone]) => zone),
      ),
    );

    expect([...zones]).toEqual([SOCIETY_TIME_ZONE]);
  });
});
