// Classifieds listings (backlog K-1): the categories, limits, checks and wording that the "Post a
// listing" form and its Server Functions share. No server code, so the form and the tests can use
// it. The database enforces the same limits (supabase/migrations/20261126210923_listings.sql).

/** The five categories (board-decisions §7), as the listings table stores them. */
export const LISTING_CATEGORIES = [
  { value: "musicians_wanted", title: "Musicians Wanted" },
  { value: "gear", title: "Gear" },
  { value: "merch", title: "Merch" },
  { value: "street_team", title: "Street Team" },
  { value: "member_connect", title: "Member Connect" },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number]["value"];

/**
 * How the poster wants to be contacted: by email, through the website (their address stays
 * private), or by phone, at the number on their profile.
 */
export type ContactPreference = "email" | "phone";

export const TITLE_MAX_LENGTH = 100;
export const BODY_MAX_LENGTH = 2000;
/** The most a price can be: the listings table keeps up to 999,999.99. */
const PRICE_MAX = 999_999.99;

/** The most a photo may weigh: the listing-photos bucket's limit. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** The photo types the listing-photos bucket accepts, with the extension each is stored under. */
const PHOTO_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/** For the file input's `accept`. */
export const PHOTO_TYPES = Object.keys(PHOTO_EXTENSIONS).join(",");

/** The extension a photo of this type is stored under, or null for a type the bucket refuses. */
function photoExtension(type: string): string | null {
  return Object.hasOwn(PHOTO_EXTENSIONS, type)
    ? PHOTO_EXTENSIONS[type as keyof typeof PHOTO_EXTENSIONS]
    : null;
}

/** How long an approved listing runs (board-decisions §7). */
export const LISTING_DAYS = 60;

export const LISTING_MESSAGES = {
  unavailable: "That didn't work. Please try again in a few minutes.",
  join: "Posting in the classifieds is a member benefit. Join the Society to post a listing.",
  renew: "Your membership has ended. Renew it to post a listing.",
  categoryMissing: "Choose a category.",
  titleMissing: "Give your listing a title.",
  titleTooLong: `Keep the title to ${TITLE_MAX_LENGTH} characters.`,
  bodyMissing: "Describe what you're offering or looking for.",
  bodyTooLong: `Keep the details to ${BODY_MAX_LENGTH.toLocaleString("en-US")} characters.`,
  priceInvalid: "Enter the price in dollars, such as 650 or 19.99, or leave it blank.",
  priceTooHigh: "Enter a price under $1,000,000.",
  contactMissing: "Choose how people should contact you.",
  phoneMissing:
    "Your profile has no phone number, so people can contact you by email only. Choose email.",
  photoType: "Choose a JPEG, PNG or WebP photo.",
  photoEmpty: "That photo is empty. Choose another one.",
  photoTooBig: "That photo is over 10 MB. Choose a smaller one.",
  uploadFailed: "The photo didn't upload. Check your connection and try again.",
  photoNotUploaded: "The photo didn't finish uploading, so the listing wasn't sent. Try again.",
} as const;

/** A field a check can fail on: also the name of its control(s) in the form. */
export type ListingField = "category" | "title" | "body" | "price" | "photo" | "contactPref";

/** A listing as the form sends it: every value as typed or chosen. */
export type ListingDraft = {
  category: unknown;
  title: unknown;
  body: unknown;
  price: unknown;
  contactPref: unknown;
};

/** A listing that passed the checks, ready for the listings table. */
export type ListingDetails = {
  category: ListingCategory;
  title: string;
  body: string;
  price: number | null;
  contactPref: ContactPreference;
};

export type ListingProblem = { field: ListingField; message: string };

function isCategory(value: unknown): value is ListingCategory {
  return LISTING_CATEGORIES.some((category) => category.value === value);
}

/** The price in dollars from what the poster typed ("650", "$1,200", "19.99"); blank is none. */
export function parsePrice(value: unknown): { price: number | null } | { problem: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { price: null };
  const digits = text.replace(/^\$\s*/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return { problem: LISTING_MESSAGES.priceInvalid };
  const price = Number(digits);
  return price > PRICE_MAX ? { problem: LISTING_MESSAGES.priceTooHigh } : { price };
}

/**
 * Checks a listing the way the database will, and tidies it: the title on one line, the details
 * with plain line breaks, both trimmed. `phone` is the poster's phone number, if their profile
 * has one: choosing phone needs it.
 */
export function checkListing(
  draft: ListingDraft,
  phone: string | null,
): { listing: ListingDetails } | ListingProblem {
  if (!isCategory(draft.category)) {
    return { field: "category", message: LISTING_MESSAGES.categoryMissing };
  }
  const title = typeof draft.title === "string" ? draft.title.trim().replace(/\s+/g, " ") : "";
  if (!title) return { field: "title", message: LISTING_MESSAGES.titleMissing };
  if (title.length > TITLE_MAX_LENGTH) {
    return { field: "title", message: LISTING_MESSAGES.titleTooLong };
  }
  const body = typeof draft.body === "string" ? draft.body.replace(/\r\n?/g, "\n").trim() : "";
  if (!body) return { field: "body", message: LISTING_MESSAGES.bodyMissing };
  if (body.length > BODY_MAX_LENGTH) {
    return { field: "body", message: LISTING_MESSAGES.bodyTooLong };
  }
  const price = parsePrice(draft.price);
  if ("problem" in price) return { field: "price", message: price.problem };
  const contactPref = draft.contactPref;
  if (contactPref !== "email" && contactPref !== "phone") {
    return { field: "contactPref", message: LISTING_MESSAGES.contactMissing };
  }
  if (contactPref === "phone" && !phone) {
    return { field: "contactPref", message: LISTING_MESSAGES.phoneMissing };
  }
  return { listing: { category: draft.category, title, body, price: price.price, contactPref } };
}

/** A photo the browser is about to upload, or a problem to report before it starts. */
export function checkPhoto(photo: { size: number; type: string }): string | null {
  if (!photoExtension(photo.type)) return LISTING_MESSAGES.photoType;
  if (photo.size <= 0) return LISTING_MESSAGES.photoEmpty;
  if (photo.size > MAX_PHOTO_BYTES) return LISTING_MESSAGES.photoTooBig;
  return null;
}

/**
 * Where a member's photo goes in the listing-photos bucket: their own folder, then a new random
 * name with the type's extension. Null for a type the bucket doesn't take.
 */
export function photoPathFor(userId: string, type: string): string | null {
  const extension = photoExtension(type);
  return extension ? `${userId}/${crypto.randomUUID()}.${extension}` : null;
}

const PHOTO_PATH = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Whether `path` is a photo path made by photoPathFor for the member `userId`. */
export function isOwnPhotoPath(userId: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  return PHOTO_PATH.exec(path)?.[1] === userId;
}

export type PreparePhotoResult =
  { status: "ready"; path: string; uploadUrl: string } | { status: "error"; message: string };

export type SubmitListingResult =
  | { status: "submitted"; title: string }
  | { status: "error"; field: ListingField | null; message: string };
