// My listings (backlog K-4): where each of a member's classifieds listings stands, whether its
// poster can renew it, and the wording the page and its Server Functions use. No server code, so
// the page and the tests can use it.
//
// The renewal rule is the database's, renew_listing() in
// supabase/migrations/20261127223233_listing_renewal.sql: a live listing from 5 days before it
// comes down (on the Society's calendar, the day the reminder goes out), or a listing that has come
// down, by a poster whose membership is current. A renewal runs 60 days from that moment, with no
// new review. The page offers Renew by the same rule, so what it offers, the database allows.

import type { TagTone } from "@/components/ui/tag";
import { dateInSocietyTimeZone, formatSocietyDate, societyInstant } from "@/lib/society-time";
import { LISTING_DAYS, type ListingCategory } from "./listing-state";

/** From how many days before a listing comes down its poster can renew it: the reminder's day. */
export const RENEW_WITHIN_DAYS = 5;

export const LISTING_STATUSES = ["pending", "live", "rejected", "expired"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** One of the member's own listings, as My listings reads it (any status). */
export type MyListing = {
  id: string;
  category: ListingCategory;
  title: string;
  price: number | null;
  status: ListingStatus;
  /** The moderator's reason, for a rejected listing. */
  rejectReason: string | null;
  /** When it was posted (ISO 8601). */
  createdAt: string;
  /** When it comes down, or came down (ISO 8601); null until a moderator approves it. */
  expiresAt: string | null;
};

/** Where a listing stands at a given moment, as the poster needs to know it. */
export type ListingStanding =
  /** Waiting for a moderator. */
  | { kind: "pending" }
  /** A moderator didn't approve it (or took it down), with their reason. */
  | { kind: "rejected"; reason: string | null }
  /** On the classifieds until expiresAt. Renewable from renewableFrom (an instant). */
  | { kind: "live"; expiresAt: string; renewable: boolean; renewableFrom: string }
  /** Came down at expiresAt (null if it never had one). Renewable. */
  | { kind: "expired"; expiresAt: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day `instant` falls on in the Society's time zone, counted in days since 1970. */
function societyDayNumber(instant: string | Date): number {
  return Date.parse(`${dateInSocietyTimeZone(instant)}T00:00:00Z`) / DAY_MS;
}

/** Midnight in the Ozarks at the start of the day 5 days before the listing comes down. */
export function renewableFrom(expiresAt: string): string {
  const [year, month, day] = (dateInSocietyTimeZone(expiresAt) ?? "").split("-").map(Number);
  return societyInstant({
    year,
    month,
    day: day - RENEW_WITHIN_DAYS,
    hour: 0,
    minute: 0,
  }).toISOString();
}

/**
 * Where `listing` stands at `now`. A live listing past its expires_at has come down, even before
 * the daily job marks it expired: nobody else sees it any more.
 */
export function listingStanding(listing: MyListing, now: Date): ListingStanding {
  const { status, expiresAt } = listing;
  if (status === "pending") return { kind: "pending" };
  if (status === "rejected") return { kind: "rejected", reason: listing.rejectReason };
  if (status === "expired" || expiresAt === null || Date.parse(expiresAt) <= now.getTime()) {
    return { kind: "expired", expiresAt };
  }
  const daysLeft = societyDayNumber(expiresAt) - societyDayNumber(now);
  return {
    kind: "live",
    expiresAt,
    renewable: daysLeft <= RENEW_WITHIN_DAYS,
    renewableFrom: renewableFrom(expiresAt),
  };
}

/** The tag color for a listing that stands so, as the concept colors statuses. */
export const STANDING_TONES: Record<ListingStanding["kind"], TagTone> = {
  pending: "accent",
  live: "success",
  rejected: "danger",
  expired: "muted",
};

/** Whether the poster can renew a listing that stands so, membership aside. */
export function isRenewable(standing: ListingStanding): boolean {
  return standing.kind === "expired" || (standing.kind === "live" && standing.renewable);
}

/** The result of a Renew or Remove press, for the page to show. */
export type MyListingResult =
  { status: "renewed" | "removed"; message: string } | { status: "error"; message: string };

export const MY_LISTINGS_MESSAGES = {
  unavailable: "That didn't work. Please try again in a few minutes.",
  gone: "That listing isn't in your listings any more.",
  join: "Posting and renewing listings is a member benefit. Join the Society to renew a listing.",
  renew: "Your membership has ended. Renew it, then you can renew your listings.",
} as const;

export function renewedMessage(title: string, expiresAt: string): string {
  return `“${title}” is renewed: it's on the classifieds until ${formatSocietyDate(expiresAt)}.`;
}

export function removedMessage(title: string): string {
  return `“${title}” is removed. It's no longer on the classifieds.`;
}

/**
 * Why a renewal changed nothing, from the listing as it is now (null when the member has no such
 * listing) and whether the member's membership is current ("join" or "renew" when it isn't).
 */
export function notRenewedMessage(
  listing: MyListing | null,
  membership: "current" | "join" | "renew",
  now: Date,
): string {
  if (!listing) return MY_LISTINGS_MESSAGES.gone;
  if (membership !== "current") return MY_LISTINGS_MESSAGES[membership];
  const standing = listingStanding(listing, now);
  switch (standing.kind) {
    case "pending":
      return `“${listing.title}” is waiting for review, so there's nothing to renew yet.`;
    case "rejected":
      return `“${listing.title}” wasn't approved, so it can't be renewed. Post it again with the moderator's changes.`;
    case "live":
      return standing.renewable
        ? MY_LISTINGS_MESSAGES.unavailable
        : `“${listing.title}” is on the classifieds until ${formatSocietyDate(standing.expiresAt)}. You can renew it from ${formatSocietyDate(standing.renewableFrom)}.`;
    case "expired":
      return MY_LISTINGS_MESSAGES.unavailable;
  }
}

/**
 * What the page says about a listing that stands so: a short label and a sentence. `canRenew`:
 * the poster's membership is current, so the page offers Renew (otherwise it says once, above the
 * list, how to renew the membership).
 */
export function standingText(
  standing: ListingStanding,
  canRenew: boolean,
): { label: string; detail: string } {
  switch (standing.kind) {
    case "pending":
      return {
        label: "Awaiting review",
        detail: "A moderator reviews it before it goes on the classifieds. We'll email you then.",
      };
    case "rejected":
      return {
        label: "Not approved",
        detail: standing.reason
          ? `The moderator's reason: ${standing.reason}`
          : "A moderator didn't approve it.",
      };
    case "live": {
      const until = `On the classifieds until ${formatSocietyDate(standing.expiresAt)}.`;
      if (!canRenew) return { label: "Live", detail: until };
      return {
        label: "Live",
        detail: standing.renewable
          ? `${until} Renew it to keep it up for another ${LISTING_DAYS} days.`
          : `${until} You can renew it from ${formatSocietyDate(standing.renewableFrom)}.`,
      };
    }
    case "expired": {
      const cameDown = standing.expiresAt
        ? `Came down on ${formatSocietyDate(standing.expiresAt)}.`
        : "No longer on the classifieds.";
      return {
        label: "Expired",
        detail: canRenew
          ? `${cameDown} Renew it to put it back up for ${LISTING_DAYS} days.`
          : cameDown,
      };
    }
  }
}

/** My Account's one-line summary of a listing that stands so: "Live, until Jan 30, 2027". */
export function standingSummary(standing: ListingStanding): string {
  switch (standing.kind) {
    case "pending":
      return "Awaiting review";
    case "rejected":
      return "Not approved";
    case "live":
      return `Live, until ${formatSocietyDate(standing.expiresAt)}`;
    case "expired":
      return standing.expiresAt ? `Expired on ${formatSocietyDate(standing.expiresAt)}` : "Expired";
  }
}
