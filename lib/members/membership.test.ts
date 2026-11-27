import { describe, expect, it } from "vitest";
import type { MembershipLevel } from "@/sanity/schemas/options";
import { activeLevel, type Viewer } from "./access";
import {
  formatMembershipDate,
  joinedYear,
  levelTitle,
  membershipStanding,
  statusLabel,
  type MembershipFacts,
} from "./membership";

// Noon in the Ozarks on December 31, 2026 (Central Standard Time, UTC-6).
const NOW = new Date("2026-12-31T18:00:00Z");
const band = (expiresAt: string | null, autoRenew = false): MembershipFacts => ({
  level: "band",
  expiresAt,
  autoRenew,
});

describe("membershipStanding", () => {
  it("is no membership before the first payment, or with no valid expiry", () => {
    expect(membershipStanding({ level: null, expiresAt: null, autoRenew: false }, NOW)).toEqual({
      kind: "none",
    });
    expect(membershipStanding(band(null), NOW)).toEqual({ kind: "none" });
    expect(membershipStanding(band("not a date"), NOW)).toEqual({ kind: "none" });
    // A future expiry without a level can't come from a payment, and grants nothing.
    expect(
      membershipStanding({ level: null, expiresAt: "2027-06-01T05:00:00Z", autoRenew: false }, NOW),
    ).toEqual({ kind: "none" });
  });

  it("has lapsed from the moment expires_at passes, with no grace period", () => {
    expect(membershipStanding(band(NOW.toISOString()), NOW)).toEqual({
      kind: "lapsed",
      level: "band",
      expiresAt: NOW.toISOString(),
    });
    expect(membershipStanding(band("2026-10-01T05:00:00Z", true), NOW)).toMatchObject({
      kind: "lapsed",
    });
    expect(
      membershipStanding({ level: null, expiresAt: "2026-10-01T05:00:00Z", autoRenew: false }, NOW),
    ).toEqual({ kind: "lapsed", level: null, expiresAt: "2026-10-01T05:00:00Z" });
  });

  it("is active until expires_at, a second before it too", () => {
    const expiresAt = new Date(NOW.getTime() + 1000).toISOString();
    expect(membershipStanding(band(expiresAt), NOW)).toEqual({
      kind: "active",
      level: "band",
      expiresAt,
      autoRenew: false,
      endsSoon: true,
    });
  });

  it("ends soon within 30 days on the Society's calendar, not by UTC dates", () => {
    // 11:30 PM on January 30 in Central Time, though it's already January 31 in UTC: 30 days on the
    // Society's calendar after December 31.
    expect(membershipStanding(band("2027-01-31T05:30:00Z"), NOW)).toMatchObject({
      endsSoon: true,
    });
    // The first minute of January 31 in Central Time: 31 days.
    expect(membershipStanding(band("2027-01-31T06:00:00Z"), NOW)).toMatchObject({
      endsSoon: false,
    });
  });

  it("never ends soon for a member on yearly auto-renew: it renews by itself", () => {
    expect(membershipStanding(band("2027-01-02T06:00:00Z", true), NOW)).toEqual({
      kind: "active",
      level: "band",
      expiresAt: "2027-01-02T06:00:00Z",
      autoRenew: true,
      endsSoon: false,
    });
  });

  it("calls a membership active exactly when activeLevel lets the member see members' content", () => {
    const cases: MembershipFacts[] = [
      { level: null, expiresAt: null, autoRenew: false },
      band(null),
      band("2026-12-31T17:59:59Z"),
      band(NOW.toISOString()),
      band("2026-12-31T18:00:01Z"),
      band("2027-12-31T06:00:00Z", true),
      { level: null, expiresAt: "2027-06-01T05:00:00Z", autoRenew: false },
      { level: "sponsor", expiresAt: "2027-06-01T05:00:00Z", autoRenew: false },
    ];
    for (const facts of cases) {
      const viewer: Viewer = { kind: "member", userId: "u", ...facts };
      const active = membershipStanding(facts, NOW).kind === "active";
      expect(active, JSON.stringify(facts)).toBe(activeLevel(viewer, NOW) !== null);
    }
  });
});

describe("statusLabel", () => {
  it("says where the membership stands in the member's words", () => {
    expect(statusLabel({ kind: "none" })).toBe("Not a member yet");
    expect(statusLabel(membershipStanding(band("2026-01-01T06:00:00Z"), NOW))).toBe("Ended");
    expect(statusLabel(membershipStanding(band("2027-01-10T06:00:00Z"), NOW))).toBe(
      "Expiring soon",
    );
    expect(statusLabel(membershipStanding(band("2027-01-10T06:00:00Z", true), NOW))).toBe("Active");
    expect(statusLabel(membershipStanding(band("2027-09-10T05:00:00Z"), NOW))).toBe("Active");
  });
});

describe("formatting", () => {
  it("writes a date as the day it falls on in Central Time", () => {
    // 11:30 PM on March 14 in Central Daylight Time.
    expect(formatMembershipDate("2027-03-15T04:30:00Z")).toBe("March 14, 2027");
    expect(formatMembershipDate("2027-03-15T05:00:00Z")).toBe("March 15, 2027");
  });

  it("gives the year the member joined, in Central Time", () => {
    // 9 PM on December 31, 2018 in Central Time.
    expect(joinedYear("2019-01-01T03:00:00Z")).toBe("2018");
    expect(joinedYear("2019-06-01T17:00:00Z")).toBe("2019");
    expect(joinedYear(null)).toBeNull();
    expect(joinedYear("soon")).toBeNull();
  });

  it("names each level as the board does", () => {
    const levels: MembershipLevel[] = ["individual", "band", "business", "sponsor"];
    expect(levels.map(levelTitle)).toEqual(["Individual", "Band", "Business", "Sponsor"]);
  });
});
