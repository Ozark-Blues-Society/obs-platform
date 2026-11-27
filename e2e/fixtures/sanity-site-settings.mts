/**
 * Site settings for the e2e stand-in for Sanity (../support/sanity-stand-in.mts), for My Account
 * (backlog M-8): a few rows of the benefits table and two member perk codes, one for every level
 * and one for Sponsor members only. Each code is a marker, so a test can check that no response
 * reaches someone who may not see it.
 *
 * Only the membership fields are filled in: no footer text, social links or menu links, so the
 * header and footer stay the built-in ones that other tests expect.
 */

/** The perk code for every level: only active members may get it. */
export const MEMBER_PERK_CODE = "E2E-MEMBER-PERK-5B1E";
/** The perk code for Sponsor members: only active Sponsor members may get it. */
export const SPONSOR_PERK_CODE = "E2E-SPONSOR-PERK-9C4A";

const ALL_LEVELS = ["individual", "band", "business", "sponsor"];

/** The benefits in the settings below, each with the levels that get it. */
export const BENEFITS = [
  { text: "Post in the classifieds", levels: ALL_LEVELS },
  { text: "10% off paid Society events and other paid items", levels: ["sponsor"] },
  { text: "Venue directory: booking contacts", levels: ["band", "business", "sponsor"] },
];

export const SITE_SETTINGS_DOCUMENTS = [
  {
    _id: "siteSettings",
    _type: "siteSettings",
    _updatedAt: "2026-11-27T12:00:00Z",
    membershipBenefits: BENEFITS.map(({ text, levels }, i) => ({
      _type: "benefit",
      _key: `benefit-${i}`,
      benefit: text,
      levels,
    })),
    perkCodes: [
      {
        _type: "perkCode",
        _key: "member",
        label: "Member discount code",
        code: MEMBER_PERK_CODE,
        details: "15% off Society merchandise at the merch table (not bulk orders).",
        levels: ALL_LEVELS,
      },
      {
        _type: "perkCode",
        _key: "sponsor",
        label: "Sponsor discount code",
        code: SPONSOR_PERK_CODE,
        details: "10% off paid Society events and other paid items.",
        levels: ["sponsor"],
      },
    ],
  },
];
