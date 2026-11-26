// Fixed choices shared by the schemas, the site and the tests. Each list's `value` is what Sanity
// stores and the site reads; `title` is what editors see. Changing a value needs a code change (and
// probably a content migration); changing a title doesn't.

/** The Society's events and publishing times are in the Ozarks' time zone (Central Time). */
export const SOCIETY_TIME_ZONE = "America/Chicago";

/**
 * Membership levels (docs/spec/board-decisions.md §1), as stored on member profiles
 * (scripts/fixtures/members.mts LEVELS). There are no family memberships (§2).
 */
export const MEMBERSHIP_LEVELS = [
  { value: "individual", title: "Individual" },
  { value: "band", title: "Band" },
  { value: "business", title: "Business" },
  { value: "sponsor", title: "Sponsor" },
] as const;

/** Who can see a page, post or event (decision 0001; gated on the server by M-7). */
export const AUDIENCES = [
  { value: "everyone", title: "Everyone" },
  { value: "members", title: "Members only, any level" },
  { value: "levels", title: "Only some membership levels" },
] as const;

/** Page templates from the approved concept (docs/design/prototype.html). */
export const PAGE_TEMPLATES = [
  { value: "standard", title: "Standard page" },
  { value: "directory", title: "Directory" },
  { value: "spotlight", title: "Band Spotlight" },
  { value: "promo", title: "Promo Feature" },
] as const;

/** Where a page shows in the site's menus (the concept's "Show in menu"; D-2 draws the menus). */
export const MENU_PLACEMENTS = [
  { value: "none", title: "Don't add to a menu" },
  { value: "main", title: "Main menu" },
  { value: "events", title: "Main menu, under Events" },
  { value: "about", title: "Main menu, under About" },
  { value: "member-resources", title: "Main menu, under Member Resources" },
  { value: "footer", title: "Footer" },
] as const;

/** Event categories from the concept and the fixtures (scripts/fixtures/events.mts). */
export const EVENT_CATEGORIES = [
  { value: "concert", title: "Concert" },
  { value: "jam", title: "Jam" },
  { value: "workshop", title: "Workshop" },
  { value: "society", title: "Society" },
] as const;

/** Blog categories from the concept. */
export const POST_CATEGORIES = [
  { value: "recap", title: "Recap" },
  { value: "band-spotlight", title: "Band Spotlight" },
  { value: "society-news", title: "Society News" },
  { value: "education", title: "Education" },
] as const;

/**
 * How an event repeats. "monthly" keeps the weekday and its place in the month, as in the
 * concept's "Every month (same weekday)": a first date on the first Friday repeats on every first
 * Friday. P-2 expands the dates.
 */
export const RECURRENCE_FREQUENCIES = [
  { value: "none", title: "Does not repeat" },
  { value: "weekly", title: "Every week, on the same weekday" },
  { value: "monthly", title: "Every month, on the same weekday (for example, the first Friday)" },
] as const;

/** How a sponsor tier's sponsors appear on the Sponsors page (P-4). */
export const LOGO_PLACEMENTS = [
  { value: "large", title: "Large logo" },
  { value: "logo", title: "Logo" },
  { value: "name", title: "Name only, no logo" },
] as const;

/** Forms the form block can show. Each one is built in code (the volunteer form is P-5). */
export const FORMS = [
  { value: "volunteer", title: "Volunteer sign-up (sent to the volunteer coordinator)" },
] as const;

export const SOCIAL_PLATFORMS = [
  { value: "facebook", title: "Facebook" },
  { value: "instagram", title: "Instagram" },
  { value: "youtube", title: "YouTube" },
  { value: "tiktok", title: "TikTok" },
  { value: "bluesky", title: "Bluesky" },
  { value: "threads", title: "Threads" },
  { value: "x", title: "X (Twitter)" },
] as const;

/**
 * First parts of web addresses that belong to the app's own routes, so a page can't use them as
 * its web address (pages live at /<web address>). A test checks that every top-level route folder
 * in app/ is listed; the rest are routes the architecture plans (docs/spec/architecture.md).
 */
export const RESERVED_PAGE_SLUGS = [
  "account",
  "admin",
  "api",
  "auth",
  "blog",
  "classifieds",
  "donate",
  "draft-mode",
  "events",
  "sign-in",
  "sponsors",
  "studio",
] as const;

export type Option = { readonly value: string; readonly title: string };
export type OptionValue<T extends readonly Option[]> = T[number]["value"];
export type MembershipLevel = OptionValue<typeof MEMBERSHIP_LEVELS>;
export type Audience = OptionValue<typeof AUDIENCES>;
export type RecurrenceFrequency = OptionValue<typeof RECURRENCE_FREQUENCIES>;

/** A mutable copy of an option list, in the shape Sanity's `options.list` expects. */
export function optionList<T extends readonly Option[]>(
  options: T,
): { value: string; title: string }[] {
  return options.map(({ value, title }) => ({ value, title }));
}

/** The title editors see for a stored value, or the value itself if it isn't in the list. */
export function optionTitle(options: readonly Option[], value: string | undefined): string {
  return options.find((option) => option.value === value)?.title ?? value ?? "";
}
