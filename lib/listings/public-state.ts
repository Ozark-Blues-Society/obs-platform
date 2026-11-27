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

/** What the contact form starts with: a signed-in viewer's own name and address, or nothing. */
export type ContactDefaults = { name: string; email: string };

/**
 * How the viewer can reach a listing's poster (decision 0009), chosen on the server, so a visitor's
 * page never holds a phone number:
 * - own: the viewer posted it;
 * - phone: the poster asked for calls, at the number on their profile, and the viewer is signed in
 *   (numbers show to signed-in people only);
 * - message: anyone else writes through the site, which emails the message on; the poster's
 *   address stays private. `phoneForMembers` when the poster asked for calls but the viewer, a
 *   visitor, may not see the number.
 */
export type ListingContact =
  | { kind: "own" }
  | { kind: "phone"; phone: string }
  | { kind: "message"; phoneForMembers: boolean; defaults: ContactDefaults };

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

/** The most a sender's name may hold. */
export const NAME_MAX_LENGTH = 100;

/** The most an email address may hold (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

/** The most a message to a poster may hold. */
export const MESSAGE_MAX_LENGTH = 2000;

/** How many messages one sender, by email or network address, may send in a day (decision 0009). */
export const MESSAGES_PER_SENDER = 10;

/** How many messages one listing may get in a day (decision 0009). */
export const MESSAGES_PER_LISTING = 20;

/**
 * How long after the page appears a message may go: people take longer to write one, scripts that
 * post at once don't (decision 0009).
 */
export const MIN_SECONDS_TO_SEND = 3;

export const CONTACT_MESSAGES = {
  nameMissing: "Give your name, so the poster knows who wrote.",
  nameTooLong: `Keep your name to ${NAME_MAX_LENGTH} characters.`,
  emailInvalid: "Enter your email address, such as name@example.com, so the poster can reply.",
  messageMissing: "Write your message.",
  messageTooLong: `Keep your message to ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`,
  tooQuick: "That was quick. Check your message, then send it again.",
  senderLimit: `You've sent ${MESSAGES_PER_SENDER} messages through the classifieds today, the most there can be in a day. Try again tomorrow.`,
  listingLimit:
    "This listing has had a lot of messages today, so it can't take more until tomorrow.",
  gone: "This listing isn't on the classifieds any more, so your message wasn't sent.",
  own: "This is your own listing, so there's no one to send it to.",
  byPhone: "This poster asked to be contacted by phone, so your message wasn't sent.",
  unavailable: "Your message wasn't sent. Please try again in a few minutes.",
} as const;

/** The contact form's hidden field: a name scripts fill in, on a field people never see. */
export const TRAP_FIELD = "website";

/** A field of the contact form, also the name of its control. */
export type ContactField = "name" | "email" | "message";

/** The contact form as sent: each value as typed. */
export type ContactValues = Record<ContactField, string>;

/** The contact form's values from its form data; anything missing is empty. */
export function readContactForm(formData: FormData): ContactValues {
  const text = (name: ContactField) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return { name: text("name"), email: text("email"), message: text("message") };
}

/** An email address as people write one: something@something.something, no spaces. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The contact form's values as the poster will read them, or the first problem, in the order the
 * fields appear: the name on one line, the address trimmed, the message with plain line breaks.
 */
export function checkContact(
  values: ContactValues,
): { contact: ContactValues } | { field: ContactField; problem: string } {
  const name = values.name.trim().replace(/\s+/g, " ");
  if (!name) return { field: "name", problem: CONTACT_MESSAGES.nameMissing };
  if (name.length > NAME_MAX_LENGTH)
    return { field: "name", problem: CONTACT_MESSAGES.nameTooLong };
  const email = values.email.trim();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL.test(email)) {
    return { field: "email", problem: CONTACT_MESSAGES.emailInvalid };
  }
  const message = values.message.replace(/\r\n?/g, "\n").trim();
  if (!message) return { field: "message", problem: CONTACT_MESSAGES.messageMissing };
  if (message.length > MESSAGE_MAX_LENGTH) {
    return { field: "message", problem: CONTACT_MESSAGES.messageTooLong };
  }
  return { contact: { name, email, message } };
}

/** The form that writes to a poster, after each try: what was typed comes back unless it went. */
export type ContactState =
  | { status: "idle" }
  | { status: "sent"; message: string }
  | { status: "error"; field: ContactField | null; message: string; values: ContactValues };

/** What the sender reads once their message has gone. */
export function sentMessage(poster: string | null, senderEmail: string): string {
  return `Message sent. ${poster ?? "The poster"} can reply to you at ${senderEmail}.`;
}
