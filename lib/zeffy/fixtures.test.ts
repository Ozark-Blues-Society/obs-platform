// @vitest-environment node
// The level-mapping config and the Zeffy fixtures hold what M-5, A-1 and the Z-items test against,
// and nothing real. (lib/zeffy/schemas.test.ts checks their shape against the spec snapshot.)
import { describe, expect, it } from "vitest";
import { MEMBERSHIP_LEVELS } from "@/sanity/schemas/options";
import * as fixtures from "./fixtures";
import {
  MEMBERSHIP_CAMPAIGN_ID,
  SYNTHETIC_ZEFFY_ID,
  syntheticZeffyId,
  ZEFFY_LEVEL_MAPPING,
} from "./level-mapping";

const {
  donationCampaign,
  disputedMembershipPayment,
  membershipCampaign,
  offlineMembershipPayment,
  recurringMembershipPayment,
  refundedMembershipPayment,
  ticketingCampaign,
  zeffyErrors,
} = fixtures;

describe("ZEFFY_LEVEL_MAPPING", () => {
  it("maps one rate of the membership form to each level", () => {
    expect(ZEFFY_LEVEL_MAPPING.map((mapping) => mapping.level)).toEqual(
      MEMBERSHIP_LEVELS.map((level) => level.value),
    );
    const keys = ZEFFY_LEVEL_MAPPING.map(({ campaignId, rateId }) => `${campaignId} ${rateId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ZEFFY_LEVEL_MAPPING.every((m) => m.campaignId === MEMBERSHIP_CAMPAIGN_ID)).toBe(true);
  });

  it("holds synthetic ids only, until the real ones go into production at launch (Q-5)", () => {
    for (const { campaignId, rateId } of ZEFFY_LEVEL_MAPPING) {
      expect(campaignId).toMatch(SYNTHETIC_ZEFFY_ID);
      expect(rateId).toMatch(SYNTHETIC_ZEFFY_ID);
    }
    expect(syntheticZeffyId("rate", 4)).toBe("00000000-0000-4000-8300-020000000004");
  });
});

describe("the Zeffy fixtures", () => {
  const everything = JSON.stringify(fixtures);

  it("use synthetic ids and @example.com addresses only", () => {
    const uuids = everything.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    );
    expect(uuids?.length).toBeGreaterThan(50);
    for (const uuid of uuids ?? []) expect(uuid).toMatch(SYNTHETIC_ZEFFY_ID);
    const addresses = everything.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
    expect(addresses.length).toBeGreaterThan(5);
    for (const address of addresses) expect(address).toMatch(/@example\.com$/);
    const links = everything.match(/https?:\/\/[^"\s]+/g) ?? [];
    for (const link of links) expect(link).toMatch(/^https:\/\/(example\.com|api\.zeffy\.com)\//);
  });

  it("sell the mapped rates on the membership form", () => {
    expect(membershipCampaign.id).toBe(MEMBERSHIP_CAMPAIGN_ID);
    expect(membershipCampaign.rates.map((rate) => rate.id)).toEqual(
      ZEFFY_LEVEL_MAPPING.map((mapping) => mapping.rateId),
    );
    expect(membershipCampaign.rates.map((rate) => rate.amount)).toEqual([3000, 5000, 10000, 50000]);
    const memberships = [
      recurringMembershipPayment,
      refundedMembershipPayment,
      disputedMembershipPayment,
      offlineMembershipPayment,
    ];
    for (const payment of memberships) {
      expect(payment.campaign_category).toBe("membership");
      const [item] = payment.items;
      expect(
        ZEFFY_LEVEL_MAPPING.some(
          (mapping) =>
            mapping.campaignId === payment.campaign_id && mapping.rateId === item.rate_id,
        ),
      ).toBe(true);
    }
  });

  it("cover auto-renew, a full refund, a lost dispute and a payment recorded by hand", () => {
    expect(recurringMembershipPayment.recurring).toMatchObject({
      is_recurring: true,
      status: "active",
      current_period_end: 1826731800,
    });
    expect(refundedMembershipPayment.refund_status).toBe("full");
    expect(refundedMembershipPayment.refunds.map((refund) => refund.amount)).toEqual([
      refundedMembershipPayment.amount,
    ]);
    expect(disputedMembershipPayment.dispute?.status).toBe("lost");
    expect(offlineMembershipPayment).toMatchObject({ type: "manual", recurring: null });
  });

  it("have a ticketing campaign with dates and rates, and a donation form", () => {
    expect(ticketingCampaign.type).toBe("ticketing");
    expect(ticketingCampaign.occurrences).toHaveLength(2);
    expect(ticketingCampaign.rates.length).toBeGreaterThan(1);
    expect(donationCampaign.type).toBe("donation_form");
  });

  it("have an error envelope whose status matches each failure", () => {
    const statuses = Object.values(zeffyErrors).map((envelope) => envelope.error.status);
    expect(statuses).toEqual([400, 401, 403, 404, 409, 422, 429, 500]);
    expect(zeffyErrors.organizationNotVerified.error.code).toBe("organization_not_verified");
  });
});
