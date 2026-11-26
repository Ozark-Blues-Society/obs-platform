/**
 * Synthetic classifieds listings, posted by fixture members. The listings table arrives with K-1;
 * add these to the seed (seed-sql.mts) then.
 */
import { fixtureUuid, memberByEmail } from "./members.mts";

/** Classifieds categories (docs/spec/board-decisions.md §7). */
export const LISTING_CATEGORIES = [
  "Musicians Wanted",
  "Gear",
  "Merch",
  "Street Team",
  "Member Connect",
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_STATUSES = ["pending", "live", "rejected", "expired"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** A listing runs this many days from approval (§7). */
export const LISTING_DAYS = 60;

export interface FixtureListing {
  id: string;
  /** The poster: a fixture member's id. */
  profileId: string;
  category: ListingCategory;
  title: string;
  body: string;
  /** Asking price in US dollars, or null when nothing is for sale. */
  price: number | null;
  /** How the poster prefers to be contacted. K-1 settles the real options. */
  contactPref: "email" | "phone";
  status: ListingStatus;
  rejectReason: string | null;
  createdDaysAgo: number;
  /** Null until a moderator approves the listing. */
  approvedDaysAgo: number | null;
  /** LISTING_DAYS after approval, in days from now; null when never approved. */
  expiresInDays: number | null;
}

type Input = Omit<FixtureListing, "id" | "profileId" | "rejectReason" | "expiresInDays"> & {
  poster: string;
  rejectReason?: string;
};

// Covers every category and status. "Vocalist available" expires in 4 days, inside the 5-day
// renewal reminder window; "Vintage Silvertone" belongs to a member whose membership has lapsed.
const INPUTS: Input[] = [
  {
    poster: "dale.ramsey@example.com",
    category: "Musicians Wanted",
    status: "live",
    title: "Bass player needed for a Chicago-style blues band",
    body: "Gigging two or three times a month. Rehearsals on Thursdays. Must read a chart.",
    price: null,
    contactPref: "email",
    createdDaysAgo: 12,
    approvedDaysAgo: 10,
  },
  {
    poster: "tasha.moore@example.com",
    category: "Member Connect",
    status: "live",
    title: "Vocalist available for weekend gigs",
    body: "Soul and blues vocalist, 15 years on stage. Own PA for small rooms.",
    price: null,
    contactPref: "phone",
    createdDaysAgo: 57,
    approvedDaysAgo: 56,
  },
  {
    poster: "marcus.lane@example.com",
    category: "Gear",
    status: "live",
    title: "Tweed-style 1x12 tube amp, 15 W",
    body: "Hand-wired and in great condition. Local pickup only.",
    price: 650,
    contactPref: "email",
    createdDaysAgo: 20,
    approvedDaysAgo: 19,
  },
  {
    poster: "pat.walsh@example.com",
    category: "Gear",
    status: "pending",
    title: "Harmonica set (7 keys) with case",
    body: "Lightly used. Keys of C, G, A, D, E, F and B♭.",
    price: 120,
    contactPref: "email",
    createdDaysAgo: 1,
    approvedDaysAgo: null,
  },
  {
    poster: "ruth.abbott@example.com",
    category: "Musicians Wanted",
    status: "pending",
    title: "Keys player wanted for a gospel blues group",
    body: "Hammond experience a plus. Two rehearsals a month.",
    price: null,
    contactPref: "email",
    createdDaysAgo: 2,
    approvedDaysAgo: null,
  },
  {
    poster: "terry.mills@example.com",
    category: "Gear",
    status: "rejected",
    title: "CHEAP SUNGLASSES best prices click here!!!",
    body: "Visit my site for deals.",
    price: 5,
    contactPref: "email",
    createdDaysAgo: 3,
    approvedDaysAgo: null,
    rejectReason: "Not related to music or the Society.",
  },
  {
    poster: "chris.price@example.com",
    category: "Merch",
    status: "live",
    title: "Band T-shirts, all sizes",
    body: "Screen-printed shirts from our fall tour. Pick one up at the weekly open jam.",
    price: 20,
    contactPref: "email",
    createdDaysAgo: 30,
    approvedDaysAgo: 29,
  },
  {
    poster: "grace.holloway@example.com",
    category: "Street Team",
    status: "live",
    title: "Poster crew for the Winter Blues Revue",
    body: "Help hang posters around town the two weekends before the show. Free entry for the crew.",
    price: null,
    contactPref: "phone",
    createdDaysAgo: 8,
    approvedDaysAgo: 7,
  },
  {
    poster: "robin.fields@example.com",
    category: "Member Connect",
    status: "live",
    title: "Carpool to the Blues Challenge auditions",
    body: "Driving from the north side with two seats free. Split the gas?",
    price: null,
    contactPref: "email",
    createdDaysAgo: 5,
    approvedDaysAgo: 4,
  },
  {
    poster: "wes.turner@example.com",
    category: "Gear",
    status: "expired",
    title: "Vintage Silvertone acoustic guitar",
    body: "Plays well. Case included.",
    price: 400,
    contactPref: "phone",
    createdDaysAgo: 80,
    approvedDaysAgo: 75,
  },
  {
    poster: "jesse.carter@example.com",
    category: "Musicians Wanted",
    status: "expired",
    title: "Drummer looking for a working band",
    body: "Shuffle, swing and Texas styles. Has transportation and a cajón for quiet gigs.",
    price: null,
    contactPref: "email",
    createdDaysAgo: 70,
    approvedDaysAgo: 68,
  },
  {
    poster: "victor.nash@example.com",
    category: "Street Team",
    status: "pending",
    title: "Merch table helpers for Delta Night",
    body: "Two volunteers to run the Society table. Helpers get in free.",
    price: null,
    contactPref: "email",
    createdDaysAgo: 0,
    approvedDaysAgo: null,
  },
  {
    poster: "margaret.sloan@example.com",
    category: "Merch",
    status: "live",
    title: "Posters from past blues festivals",
    body: "Signed and numbered prints.",
    price: 15,
    contactPref: "email",
    createdDaysAgo: 40,
    approvedDaysAgo: 38,
  },
];

export const LISTINGS: readonly FixtureListing[] = INPUTS.map(
  ({ poster, rejectReason, ...listing }, i) => ({
    ...listing,
    id: fixtureUuid(2, i + 1),
    profileId: memberByEmail(poster).id,
    rejectReason: rejectReason ?? null,
    expiresInDays: listing.approvedDaysAgo === null ? null : LISTING_DAYS - listing.approvedDaysAgo,
  }),
);
