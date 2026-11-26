import { describe, expect, it } from "vitest";
import { activeLevel, checkAccess, isMembershipLevel, VISITOR, type Viewer } from "./access";

const NOW = new Date("2026-11-26T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

type Member = Extract<Viewer, { kind: "member" }>;

const member = (level: Member["level"], expiresAt: string | null): Viewer => ({
  kind: "member",
  userId: "00000000-0000-4000-8100-000000000001",
  level,
  expiresAt,
});

const individual = member("individual", at(30 * DAY));
const band = member("band", at(30 * DAY));
const lapsed = member("band", at(-14 * DAY));
const neverPaid = member(null, null);

const EVERYONE = { audience: "everyone" };
const MEMBERS = { audience: "members" };
const BAND_UP = { audience: "levels", levels: ["band", "business", "sponsor"] };

describe("activeLevel", () => {
  it("is the level while expires_at is in the future", () => {
    expect(activeLevel(band, NOW)).toBe("band");
    expect(activeLevel(member("sponsor", at(1)), NOW)).toBe("sponsor");
  });

  it("is null from expires_at on: there is no grace period", () => {
    expect(activeLevel(member("band", NOW.toISOString()), NOW)).toBeNull();
    expect(activeLevel(member("band", at(-1)), NOW)).toBeNull();
    expect(activeLevel(lapsed, NOW)).toBeNull();
  });

  it("is null for visitors, members who never paid and unreadable dates", () => {
    expect(activeLevel(VISITOR, NOW)).toBeNull();
    expect(activeLevel(neverPaid, NOW)).toBeNull();
    expect(activeLevel(member("band", null), NOW)).toBeNull();
    expect(activeLevel(member(null, at(DAY)), NOW)).toBeNull();
    expect(activeLevel(member("band", "not a date"), NOW)).toBeNull();
  });

  it("reads Postgres timestamps as Supabase returns them", () => {
    expect(activeLevel(member("band", "2026-11-26T12:00:00.001+00:00"), NOW)).toBe("band");
    expect(activeLevel(member("band", "2026-11-26T12:00:00+00:00"), NOW)).toBeNull();
  });
});

describe("checkAccess", () => {
  it("lets anyone see an item for everyone", () => {
    for (const viewer of [VISITOR, neverPaid, lapsed, individual, band]) {
      expect(checkAccess(EVERYONE, viewer, NOW)).toEqual({ allowed: true });
    }
  });

  it("lets every active member see an item for members, whatever their level", () => {
    expect(checkAccess(MEMBERS, individual, NOW)).toEqual({ allowed: true });
    expect(checkAccess(MEMBERS, band, NOW)).toEqual({ allowed: true });
  });

  it("lets only active members at a listed level see an item for some levels", () => {
    expect(checkAccess(BAND_UP, band, NOW)).toEqual({ allowed: true });
    expect(checkAccess(BAND_UP, individual, NOW)).toEqual({ allowed: false, reason: "level" });
  });

  it("asks visitors to sign in", () => {
    expect(checkAccess(MEMBERS, VISITOR, NOW)).toEqual({ allowed: false, reason: "sign-in" });
    expect(checkAccess(BAND_UP, VISITOR, NOW)).toEqual({ allowed: false, reason: "sign-in" });
  });

  it("asks members whose membership has ended to renew, from expires_at on", () => {
    expect(checkAccess(MEMBERS, lapsed, NOW)).toEqual({ allowed: false, reason: "renew" });
    expect(checkAccess(BAND_UP, lapsed, NOW)).toEqual({ allowed: false, reason: "renew" });
    const endsNow = member("band", NOW.toISOString());
    expect(checkAccess(MEMBERS, endsNow, NOW)).toEqual({ allowed: false, reason: "renew" });
    expect(checkAccess(MEMBERS, endsNow, new Date(NOW.getTime() - 1))).toEqual({ allowed: true });
  });

  it("asks people who signed up but never paid to join", () => {
    expect(checkAccess(MEMBERS, neverPaid, NOW)).toEqual({ allowed: false, reason: "join" });
    expect(checkAccess(MEMBERS, member(null, at(DAY)), NOW)).toEqual({
      allowed: false,
      reason: "join",
    });
  });

  it("fails closed when the visibility is missing or unknown", () => {
    for (const visibility of [undefined, null, {}, { audience: null }, { audience: "public" }]) {
      expect(checkAccess(visibility, band, NOW)).toEqual({ allowed: false, reason: "level" });
      expect(checkAccess(visibility, VISITOR, NOW)).toEqual({ allowed: false, reason: "sign-in" });
    }
  });

  it("opens an item for some levels to nobody when no level is ticked", () => {
    for (const levels of [undefined, null, []]) {
      expect(checkAccess({ audience: "levels", levels }, band, NOW)).toEqual({
        allowed: false,
        reason: "level",
      });
    }
  });

  it("ignores the levels unless the audience is some levels", () => {
    expect(checkAccess({ audience: "members", levels: ["sponsor"] }, band, NOW)).toEqual({
      allowed: true,
    });
    expect(checkAccess({ audience: "everyone", levels: ["sponsor"] }, VISITOR, NOW)).toEqual({
      allowed: true,
    });
  });
});

describe("isMembershipLevel", () => {
  it("accepts the four levels and nothing else", () => {
    for (const level of ["individual", "band", "business", "sponsor"]) {
      expect(isMembershipLevel(level)).toBe(true);
    }
    for (const value of ["family", "Band", "", null, undefined, 1]) {
      expect(isMembershipLevel(value)).toBe(false);
    }
  });
});
