// The public classifieds (backlog K-3): their web addresses, what the list and a listing's page
// show, and the checks and wording of the form that writes to a poster. No server code, so the
// pages, the form and the tests can use it.

import type { TagTone } from "@/components/ui/tag";
import { CLASSIFIEDS_PATH } from "@/lib/site/navigation";
import { LISTING_CATEGORIES, type ListingCategory } from "./listing-state";
import { categoryTitle } from "./moderation-state";

/** A live listing as the classifieds show it: nothing that would reach the poster. */
export type PublicListing = {
  id: string;
  category: ListingCategory;
  title: string;
  body: string;
  price: number | null;
  /** listings.approved_at (ISO 8601): when it went on the classifieds. */
  postedAt: string;
  /** The poster's first name and last initial ("Dale R."), or null when their profile has none. */
  poster: string | null;
};

/**
 * How the viewer can reach a listing's poster, chosen on the server, so a visitor's page never
 * holds a phone number:
 * - sign-in: a visitor, who signs in first (the approved concept);
 * - own: the viewer posted it;
 * - phone: the poster asked for calls, at the number on their profile;
 * - message: a message through the site, which emails it on; the poster's address stays private.
 *   Also when the poster asked for calls but their profile no longer has a number.
 */
export type ListingContact =
  { kind: "sign-in" } | { kind: "own" } | { kind: "phone"; phone: string } | { kind: "message" };

/** A listing's own page adds its photo and how the viewer can reach the poster. */
export type ListingDetail = PublicListing & {
  /**
   * The photo as the moderator approved it, through a short-lived link; "missing" when it can't be
   * shown (replaced in Storage since, or Storage didn't answer); null without a photo.
   */
  photo: { status: "shown"; url: string } | { status: "missing" } | null;
  contact: ListingContact;
};

/** A category in a web address: musicians-wanted for musicians_wanted. */
function categorySlug(category: ListingCategory): string {
  return category.replaceAll("_", "-");
}

/** The category `?category=` asks for, or null for every listing (and for anything unknown). */
export function classifiedsCategory(value: string | string[] | undefined): ListingCategory | null {
  const wanted = Array.isArray(value) ? value[0] : value;
  return LISTING_CATEGORIES.find((each) => categorySlug(each.value) === wanted)?.value ?? null;
}

/** The classifieds' web address for a category, or for all of them. */
export function classifiedsHref(category: ListingCategory | null): string {
  return category ? `${CLASSIFIEDS_PATH}?category=${categorySlug(category)}` : CLASSIFIEDS_PATH;
}

/** The tab title for the classifieds, or one category of them. */
export function classifiedsTitle(category: ListingCategory | null): string {
  return [category && categoryTitle(category), "Classifieds", "Ozark Blues Society"]
    .filter(Boolean)
    .join(" · ");
}

/** A listing's own page. */
export function listingPath(id: string): string {
  return `${CLASSIFIEDS_PATH}/${id}`;
}

/** Whether `value` could be a listing's id (listings.id: a UUID as Postgres writes it). */
export function isListingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

/** Each category's tag color, as in the approved concept: blue, rust, brass, green and grey. */
const CATEGORY_TONES: Record<ListingCategory, TagTone> = {
  musicians_wanted: "primary",
  gear: "danger",
  merch: "accent",
  street_team: "success",
  member_connect: "muted",
};

export function categoryTone(category: ListingCategory): TagTone {
  return CATEGORY_TONES[category];
}

/** What the list holds, for screen readers and an empty list: "7 listings.", "No Gear listings…". */
export function listingsSummary(count: number, category: ListingCategory | null): string {
  const name = category ? `${categoryTitle(category)} ` : "";
  if (count === 0) return `No ${name}listings right now. Check back soon.`;
  return `${count} ${name}${count === 1 ? "listing" : "listings"}.`;
}

/** The most a message to a poster may hold. */
export const MESSAGE_MAX_LENGTH = 2000;

/** How many messages one person may send posters in a day (the database counts them). */
export const MESSAGES_PER_DAY = 10;

export const CONTACT_MESSAGES = {
  messageMissing: "Write your message.",
  messageTooLong: `Keep your message to ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`,
  limit: `You've sent ${MESSAGES_PER_DAY} messages through the classifieds today, the most there can be in a day. Try again tomorrow.`,
  gone: "This listing isn't on the classifieds any more, so your message wasn't sent.",
  own: "This is your own listing, so there's no one to send it to.",
  byPhone: "This poster asked to be contacted by phone, so your message wasn't sent.",
  unavailable: "Your message wasn't sent. Please try again in a few minutes.",
} as const;

/** The message as the poster will read it, with plain line breaks and trimmed, or a problem. */
export function checkMessage(value: unknown): { message: string } | { problem: string } {
  const message = typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
  if (!message) return { problem: CONTACT_MESSAGES.messageMissing };
  if (message.length > MESSAGE_MAX_LENGTH) return { problem: CONTACT_MESSAGES.messageTooLong };
  return { message };
}

/** The form that writes to a poster, after each try: the message comes back unless it was sent. */
export type ContactState =
  | { status: "idle" }
  | { status: "sent"; message: string }
  | { status: "error"; field: "message" | null; message: string; value: string };

/** What the sender reads once their message has gone. */
export function sentMessage(poster: string | null, senderEmail: string): string {
  return `Message sent. ${poster ?? "The poster"} will see your email address, ${senderEmail}, and can reply to you there.`;
}
