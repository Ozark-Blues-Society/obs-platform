// The membership benefits table from docs/spec/board-decisions.md §1. Site settings starts with it
// when the document is first created, in the Studio (siteSettings' initialValue) or by
// `pnpm fixtures:sanity`. After that, editors keep it up to date in the Studio.
//
// No Sanity imports, and the import names its file in full (".ts"): the fixtures script
// (scripts/fixtures/sanity-fixtures.mts) loads this file in plain Node.
import { MEMBERSHIP_LEVELS, type MembershipLevel } from "./options.ts";

const ALL_LEVELS: MembershipLevel[] = MEMBERSHIP_LEVELS.map((level) => level.value);
const BAND_AND_UP: MembershipLevel[] = ["band", "business", "sponsor"];

export const BOARD_BENEFITS = (
  [
    { _key: "classifieds", benefit: "Post in the classifieds", levels: ALL_LEVELS },
    {
      _key: "calendar",
      benefit: "Event calendar, including members-only events",
      levels: ALL_LEVELS,
    },
    {
      _key: "sponsor-discount",
      benefit: "10% off paid Society events and other paid items",
      levels: ["sponsor"],
    },
    { _key: "newsletter", benefit: "Monthly newsletter", levels: ALL_LEVELS },
    {
      _key: "drawings",
      benefit: "Eligible for VIP drawings, All Access passes and giveaways",
      levels: ALL_LEVELS,
    },
    { _key: "merch", benefit: "15% off Society merchandise (not bulk)", levels: ALL_LEVELS },
    { _key: "directory", benefit: "Venue directory: venue names and details", levels: ALL_LEVELS },
    { _key: "booking-contacts", benefit: "Venue directory: booking contacts", levels: BAND_AND_UP },
    { _key: "gigs", benefit: "Post gigs on the Event Calendar", levels: BAND_AND_UP },
    {
      _key: "presales",
      benefit: "Ticket pre-sales and early entry (General Admission)",
      levels: ["business", "sponsor"],
    },
    { _key: "spotlight", benefit: "Sponsor Spotlight highlight", levels: ["sponsor"] },
  ] satisfies { _key: string; benefit: string; levels: MembershipLevel[] }[]
).map((row) => ({ _type: "benefit" as const, ...row }));
