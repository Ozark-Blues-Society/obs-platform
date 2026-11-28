// Which membership level each rate of the Zeffy membership form buys (decision 0007, backlog M-3).
// Zeffy payments carry no metadata, so a payment's level comes from the rate on its item: M-5 looks
// up campaign_id + rate_id in the zeffy_level_mappings table, which administrators edit, and sends
// a payment whose rate isn't there to its admin review list.
//
// This config seeds that table locally (supabase/seed.sql, by `pnpm fixtures:generate`), and the
// Zeffy fixtures (lib/zeffy/fixtures.ts) sell these rates. Its ids are synthetic: the membership
// form's real campaign and rate ids come from the Society's Zeffy account at launch (backlog Q-5),
// and go into the production table, not into this file.
//
// Plain Node imports this file (scripts/fixtures/seed-sql.mts), so it imports nothing but types,
// by relative path.
import type { MembershipLevel } from "../../sanity/schemas/options.ts";

/** What a synthetic Zeffy id stands for: the two digits after 8300- in syntheticZeffyId(). */
const ZEFFY_ID_KINDS = {
  campaign: "01",
  rate: "02",
  payment: "03",
  contact: "04",
  occurrence: "05",
  item: "06",
  refund: "07",
  dispute: "08",
  question: "09",
  choice: "10",
  subscription: "11",
  user: "12",
  fund: "13",
} as const;

/**
 * A synthetic Zeffy id, a UUID like Zeffy's own: 00000000-0000-4000-8300-KKNNNNNNNNNN, where KK
 * says what it is and N counts. The fixture members' ids use 8100- and the listings' 8200-, so
 * synthetic ids are easy to spot and never clash with real ones.
 */
export function syntheticZeffyId(kind: keyof typeof ZEFFY_ID_KINDS, n: number): string {
  return `00000000-0000-4000-8300-${ZEFFY_ID_KINDS[kind]}${String(n).padStart(10, "0")}`;
}

/** Every synthetic Zeffy id matches this. */
export const SYNTHETIC_ZEFFY_ID = /^00000000-0000-4000-8300-\d{12}$/;

export interface ZeffyLevelMapping {
  /** The Zeffy campaign: the membership form. */
  campaignId: string;
  /** One of the form's rates. */
  rateId: string;
  level: MembershipLevel;
}

/** The membership form: one Zeffy campaign with a rate for each level (board decisions §1). */
export const MEMBERSHIP_CAMPAIGN_ID = syntheticZeffyId("campaign", 1);

export const ZEFFY_LEVEL_MAPPING: readonly ZeffyLevelMapping[] = [
  { campaignId: MEMBERSHIP_CAMPAIGN_ID, rateId: syntheticZeffyId("rate", 1), level: "individual" },
  { campaignId: MEMBERSHIP_CAMPAIGN_ID, rateId: syntheticZeffyId("rate", 2), level: "band" },
  { campaignId: MEMBERSHIP_CAMPAIGN_ID, rateId: syntheticZeffyId("rate", 3), level: "business" },
  { campaignId: MEMBERSHIP_CAMPAIGN_ID, rateId: syntheticZeffyId("rate", 4), level: "sponsor" },
];
