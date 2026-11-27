// What My Account says about a member's own membership (backlog M-8). Plain rules with no server
// code, so the page and the tests share them.
//
// The status follows the database's rule, private.membership_status_at() in
// supabase/migrations/20261126163935_membership_status_from_row.sql, worked out from expires_at
// when the page renders, so it's right even before the daily job updates profiles.status:
//   - lapsed once expires_at has passed (there's no grace period, board-decisions §4);
//   - expiring when it ends within 30 days on the Society's calendar (Central Time);
//   - active otherwise.
// It agrees with activeLevel() in ./access.ts, which decides what the member may see: active means
// a level and an expires_at still in the future. One difference from the database: a member on
// yearly auto-renew isn't told their membership is expiring, because Stripe renews it for them.

import { MEMBERSHIP_LEVELS, SOCIETY_TIME_ZONE, optionTitle } from "@/sanity/schemas/options";
import type { MembershipLevel } from "@/sanity/schemas/options";

/** The first renewal reminder goes out 30 days before a membership ends (board-decisions §4). */
export const EXPIRING_WITHIN_DAYS = 30;

/** The membership columns of the member's profile. */
export type MembershipFacts = {
  /** profiles.level: null until the first payment. */
  level: MembershipLevel | null;
  /** profiles.expires_at, an ISO 8601 timestamp: null until the first payment. */
  expiresAt: string | null;
  /** profiles.auto_renew: Stripe renews the membership each year. */
  autoRenew: boolean;
};

export type MembershipStanding =
  /** Not a member: never paid. */
  | { kind: "none" }
  /** The membership ended at expiresAt. */
  | { kind: "lapsed"; level: MembershipLevel | null; expiresAt: string }
  /**
   * Active until expiresAt. `endsSoon`: it ends within 30 days and won't renew by itself, so the
   * member should renew.
   */
  | {
      kind: "active";
      level: MembershipLevel;
      expiresAt: string;
      autoRenew: boolean;
      endsSoon: boolean;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

const calendarDay = new Intl.DateTimeFormat("en-US", {
  timeZone: SOCIETY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** The day `instant` falls on in the Society's time zone, counted in days since 1970. */
function societyDayNumber(instant: Date): number {
  const parts = calendarDay.formatToParts(instant);
  const part = (type: string) => Number(parts.find((each) => each.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/** Where the member's membership stands at `now`. */
export function membershipStanding(facts: MembershipFacts, now: Date): MembershipStanding {
  const expires = facts.expiresAt === null ? Number.NaN : Date.parse(facts.expiresAt);
  if (facts.expiresAt === null || !Number.isFinite(expires)) return { kind: "none" };
  if (expires <= now.getTime()) {
    return { kind: "lapsed", level: facts.level, expiresAt: facts.expiresAt };
  }
  // A future expiry without a level isn't a membership (activeLevel() agrees): it can't come from
  // a payment, which always sets both.
  if (facts.level === null) return { kind: "none" };
  const daysLeft = societyDayNumber(new Date(expires)) - societyDayNumber(now);
  return {
    kind: "active",
    level: facts.level,
    expiresAt: facts.expiresAt,
    autoRenew: facts.autoRenew,
    endsSoon: !facts.autoRenew && daysLeft <= EXPIRING_WITHIN_DAYS,
  };
}

/** The status as the member reads it, in the Status row and its tag. */
export function statusLabel(standing: MembershipStanding): string {
  switch (standing.kind) {
    case "none":
      return "Not a member yet";
    case "lapsed":
      return "Ended";
    case "active":
      return standing.endsSoon ? "Expiring soon" : "Active";
  }
}

/** The level's name as the board writes it: "Band" for band. */
export function levelTitle(level: MembershipLevel): string {
  return optionTitle(MEMBERSHIP_LEVELS, level);
}

const longDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: SOCIETY_TIME_ZONE,
});

/** "March 14, 2027": the day a timestamp such as expires_at falls on, in the Society's time zone. */
export function formatMembershipDate(timestamp: string): string {
  return longDate.format(new Date(timestamp));
}

const yearOnly = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: SOCIETY_TIME_ZONE });

/** The year in profiles.joined_at ("2019"), or null when there's no valid date. */
export function joinedYear(joinedAt: string | null): string | null {
  const joined = joinedAt === null ? Number.NaN : Date.parse(joinedAt);
  return Number.isFinite(joined) ? yearOnly.format(new Date(joined)) : null;
}
