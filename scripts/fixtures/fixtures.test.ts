// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_CATEGORIES, EVENTS, VENUES } from "./events.mts";
import { LISTING_CATEGORIES, LISTING_DAYS, LISTING_STATUSES, LISTINGS } from "./listings.mts";
import { EXPIRING_WITHIN_DAYS, LEVELS, MEMBERS, ROLES, STATUSES } from "./members.mts";
import { buildSeedSql, SEED_SQL_PATH, sqlString } from "./seed-sql.mts";

const unique = (values: readonly unknown[]) => new Set(values).size === values.length;

describe("members", () => {
  it("has 40 members covering every level and status", () => {
    expect(MEMBERS).toHaveLength(40);
    for (const level of LEVELS) {
      for (const status of STATUSES) {
        expect(
          MEMBERS.some((m) => m.level === level && m.status === status),
          `${level} / ${status}`,
        ).toBe(true);
      }
    }
  });

  it("keeps each status consistent with the expiry date", () => {
    for (const m of MEMBERS) {
      const expected =
        m.expiresInDays <= 0
          ? "lapsed"
          : m.expiresInDays <= EXPIRING_WITHIN_DAYS
            ? "expiring"
            : "active";
      expect(m.status, m.email).toBe(expected);
    }
  });

  it("uses unique ids and only synthetic contact details", () => {
    expect(unique(MEMBERS.map((m) => m.id))).toBe(true);
    expect(unique(MEMBERS.map((m) => m.email))).toBe(true);
    for (const m of MEMBERS) {
      expect(m.email).toMatch(/^[a-z]+\.[a-z]+@example\.com$/);
      if (m.phone !== null) expect(m.phone).toMatch(/^\(479\) 555-01\d\d$/);
    }
  });

  it("fills in plausible membership history", () => {
    for (const m of MEMBERS) {
      expect(Number.isInteger(m.years) && m.years >= 1, m.email).toBe(true);
      // A lapsed member can't still be on auto-renew.
      if (m.status === "lapsed") expect(m.autoRenew, m.email).toBe(false);
    }
  });

  it("gives every staff role to an active member", () => {
    for (const role of ROLES) {
      expect(
        MEMBERS.some((m) => m.roles.includes(role) && m.status === "active"),
        role,
      ).toBe(true);
    }
  });
});

describe("listings", () => {
  const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

  it("covers every category and status", () => {
    expect(unique(LISTINGS.map((l) => l.id))).toBe(true);
    for (const category of LISTING_CATEGORIES) {
      expect(
        LISTINGS.some((l) => l.category === category),
        category,
      ).toBe(true);
    }
    for (const status of LISTING_STATUSES) {
      expect(
        LISTINGS.some((l) => l.status === status),
        status,
      ).toBe(true);
    }
  });

  it("keeps each status consistent with approval and expiry", () => {
    for (const l of LISTINGS) {
      const approved = l.approvedDaysAgo !== null;
      expect(approved, l.title).toBe(l.status === "live" || l.status === "expired");
      expect(l.rejectReason !== null, l.title).toBe(l.status === "rejected");
      if (l.approvedDaysAgo !== null) {
        expect(l.approvedDaysAgo).toBeLessThanOrEqual(l.createdDaysAgo);
        expect(l.expiresInDays).toBe(LISTING_DAYS - l.approvedDaysAgo);
        expect(l.expiresInDays! > 0, l.title).toBe(l.status === "live");
      }
    }
  });

  it("is posted by fixture members, with current listings from current members", () => {
    for (const l of LISTINGS) {
      const poster = memberById.get(l.profileId);
      expect(poster, l.title).toBeDefined();
      if (l.status === "pending" || l.status === "live") {
        expect(poster!.status, l.title).not.toBe("lapsed");
      }
    }
  });
});

describe("events", () => {
  const venueIds = new Set(VENUES.map((v) => v.id));

  it("uses known venues and categories", () => {
    expect(unique([...VENUES.map((v) => v.id), ...EVENTS.map((e) => e.id)])).toBe(true);
    for (const e of EVENTS) {
      expect(EVENT_CATEGORIES, e.title).toContain(e.category);
      if (e.venueId === null) expect(e.membersOnly, e.title).toBe(true);
      else expect(venueIds.has(e.venueId), e.title).toBe(true);
      expect(e.startTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      if (e.recurrence) expect(e.recurrence.untilInDays).toBeGreaterThan(e.startsInDays);
    }
  });

  it("covers repeats, members-only events, member pricing and past events", () => {
    expect(EVENTS.some((e) => e.recurrence?.frequency === "weekly")).toBe(true);
    expect(EVENTS.some((e) => e.recurrence?.frequency === "monthly")).toBe(true);
    expect(EVENTS.some((e) => e.membersOnly)).toBe(true);
    expect(EVENTS.some((e) => e.memberPrice !== null)).toBe(true);
    expect(EVENTS.some((e) => e.startsInDays < 0)).toBe(true);
  });

  it("uses only synthetic contact details for venues", () => {
    for (const { booking } of VENUES) {
      if (booking.email !== null) expect(booking.email).toMatch(/@example\.com$/);
      if (booking.phone !== null) expect(booking.phone).toMatch(/^\(479\) 555-01\d\d$/);
    }
  });
});

describe("seed.sql", () => {
  it("is up to date with the fixtures", () => {
    expect(
      readFileSync(SEED_SQL_PATH, "utf8"),
      "supabase/seed.sql is stale: run `pnpm fixtures:generate`",
    ).toBe(buildSeedSql());
  });

  it("creates every member and escapes quotes", () => {
    const sql = buildSeedSql();
    for (const m of MEMBERS) expect(sql).toContain(sqlString(m.email));
    expect(sqlString("O'Neal")).toBe("'O''Neal'");
    expect(sql).toContain("'O''Neal'");
  });

  it("fills in every member's profile and gives out the staff roles", () => {
    const sql = buildSeedSql();
    const profiles = sql.slice(
      sql.indexOf("update public.profiles"),
      sql.indexOf("-- Staff roles."),
    );
    for (const m of MEMBERS) {
      expect(profiles, m.email).toContain(`(${sqlString(m.id)}::uuid, `);
      for (const role of m.roles) {
        expect(sql, m.email).toContain(`(${sqlString(m.id)}::uuid, ${sqlString(role)})`);
      }
    }
  });
});
