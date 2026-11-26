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
