// Formatting shared by the email templates: dates in the Society's time zone, dollar amounts,
// membership level names and links back to the site.
import {
  MEMBERSHIP_LEVELS,
  SOCIETY_TIME_ZONE,
  optionTitle,
  type MembershipLevel,
} from "../../sanity/schemas/options";

export type { MembershipLevel };

/** The level's name as the board writes it: "Band" for band. */
export function levelName(level: MembershipLevel): string {
  return optionTitle(MEMBERSHIP_LEVELS, level);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "November 26, 2026". A timestamp (an ISO 8601 string with a time, such as profiles.expires_at)
 * shows the day it falls on in the Society's time zone. A plain date ("2026-11-26") shows that day.
 */
export function formatDate(value: string): string {
  const dateOnly = DATE_ONLY.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a date: "${value}"`);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: dateOnly ? "UTC" : SOCIETY_TIME_ZONE,
  }).format(date);
}

/** "$50.00", from a whole number of cents (Stripe's unit). */
export function formatAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`Not an amount in cents: ${cents}`);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** An absolute link to a page of the site, because a link in an email can't be relative. */
export function siteLink(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

/**
 * U+2060 WORD JOINER, written as a code point so nothing invisible sits in the source. It shows as
 * nothing, and the plain-text version keeps it as it is (html-to-text turns a zero-width space
 * into a visible one).
 */
const WORD_JOINER = String.fromCodePoint(0x2060);

/**
 * Someone's own words with no web or email address an email client would turn into a link
 * (decision 0009: links in a message to a poster aren't clickable). An invisible character goes
 * after every "://", and before every "." or "@" that sits inside a word, so "example.com" and
 * "name@example.com" read the same but no longer look like addresses. Line breaks stay.
 */
export function unlinkText(text: string): string {
  return text
    .replace(/:\/\//g, `:${WORD_JOINER}//`)
    .replace(/(?<=\S)([.@])(?=\S)/g, `${WORD_JOINER}$1`);
}
