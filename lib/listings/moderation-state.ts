// Moderating classifieds listings (backlog K-2, A-3): what the moderation queue shows, the checks
// on a rejection's reason and the wording moderators see. No server code, so the queue and the
// tests can use it. The database enforces the same rules
// (supabase/migrations/20261126225448_listing_moderation.sql).

import { formatSocietyDate } from "@/lib/society-time";
import { LISTING_CATEGORIES, type ContactPreference, type ListingCategory } from "./listing-state";

/** The moderation queue (A-3), for moderators and administrators. */
export const MODERATION_PATH = "/admin/classifieds";

/** The most a rejection's reason may hold: listings.reject_reason's limit. */
export const REASON_MAX_LENGTH = 500;

/** A listing waiting for a moderator, as the queue shows it. */
export type PendingListing = {
  id: string;
  /** listings.revision: a decision applies only to the revision the moderator saw. */
  revision: number;
  category: ListingCategory;
  title: string;
  body: string;
  price: number | null;
  contactPref: ContactPreference;
  /** listings.created_at (ISO 8601). */
  submittedAt: string;
  /** The poster's first name and last initial ("Pat W."), or null when their profile has none. */
  poster: string | null;
  /**
   * The photo as the poster sent it: a short-lived link to that version of it, or "missing" when
   * it can't be shown (replaced in Storage since, or Storage didn't answer). Null without a photo.
   */
  photo: { status: "shown"; url: string } | { status: "missing" } | null;
};

/** What a moderator's decision applies to: a listing, at the revision the queue showed. */
export type ModerationTarget = { id: string; revision: number };

export type ModerationResult =
  { status: "approved" | "rejected"; message: string } | { status: "error"; message: string };

export const MODERATION_MESSAGES = {
  reasonLabel: "Reason for the poster",
  reasonHint:
    "We email this to the poster, word for word. Say what to change so the listing can be approved.",
  reasonMissing: "Write the reason for the poster.",
  reasonTooLong: `Keep the reason to ${REASON_MAX_LENGTH} characters.`,
  notModerator: "Only moderators and administrators can approve or reject listings.",
  withdrawn: "That listing was deleted by its poster, so there's nothing to decide.",
  unavailable: "That didn't work. Please try again in a few minutes.",
} as const;

/** The category's name as the board writes it: "Musicians Wanted" for musicians_wanted. */
export function categoryTitle(category: ListingCategory): string {
  return LISTING_CATEGORIES.find((each) => each.value === category)?.title ?? category;
}

/** "$650", or "$19.99" with cents. */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

/** "Pat W." from a profile's names; null when it has no first name. */
export function posterName(firstName: unknown, lastName: unknown): string | null {
  const first = typeof firstName === "string" ? firstName.trim() : "";
  if (!first) return null;
  const initial = typeof lastName === "string" ? lastName.trim().charAt(0) : "";
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/**
 * The reason as the poster will read it, with plain line breaks and trimmed, or a problem to show
 * the moderator. The rejection email quotes it word for word.
 */
export function checkReason(value: unknown): { reason: string } | { problem: string } {
  const reason = typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
  if (!reason) return { problem: MODERATION_MESSAGES.reasonMissing };
  if (reason.length > REASON_MAX_LENGTH) return { problem: MODERATION_MESSAGES.reasonTooLong };
  return { reason };
}

export function approvedMessage(title: string, expiresAt: string, emailed: boolean): string {
  const live = `“${title}” is approved and on the classifieds until ${formatSocietyDate(expiresAt)}.`;
  return emailed
    ? `${live} We emailed the poster to let them know.`
    : `${live} The email to the poster didn't go out, though, so they don't know yet.`;
}

export function rejectedMessage(title: string, emailed: boolean): string {
  return emailed
    ? `“${title}” is rejected. We emailed the poster your reason.`
    : `“${title}” is rejected, but the email to the poster didn't go out, so they haven't seen your reason.`;
}

/** Why a decision changed nothing, from the listing as it is now. */
export function notDecidedMessage(listing: {
  title: string;
  status: string;
  revision: number;
  seenRevision: number;
}): string {
  const { title, status, revision, seenRevision } = listing;
  if (status === "pending" && revision !== seenRevision) {
    return `The poster changed “${title}” while you were looking at it, so nothing was decided. Check the new version below, then decide.`;
  }
  if (status === "live") return `“${title}” was already approved, perhaps by another moderator.`;
  if (status === "rejected")
    return `“${title}” was already rejected, perhaps by another moderator.`;
  return `“${title}” isn't waiting for review any more.`;
}
