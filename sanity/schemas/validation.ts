// Custom validation rules for the Content Studio. Each returns true when the value is fine, or a
// message for the editor that says what to change. Unit tests: validation.test.ts.
import { getPublishedId, type SlugValue, type ValidationContext } from "sanity";
import { apiVersion } from "@/sanity/env";
import { SOCIETY_TIME_ZONE } from "./options";

export type RuleResult = true | string;

/** The calendar date (YYYY-MM-DD) of an instant in the Society's time zone, or undefined. */
export function dateInSocietyTimeZone(instant: string | Date): string | undefined {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SOCIETY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** "2026-11-26" → "November 26, 2026". */
function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

function listOf(items: string[]): string {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A repeating event's last date: needed, and after the first date (in Central Time). */
export function recurrenceUntilRule(
  until: string | undefined,
  context: ValidationContext,
): RuleResult {
  const frequency = (context.parent as { frequency?: string } | undefined)?.frequency;
  if (!frequency || frequency === "none") return true;
  if (!until) return "Choose the last date it repeats on.";
  const start = (context.document as { start?: unknown } | undefined)?.start;
  const startDate = typeof start === "string" ? dateInSocietyTimeZone(start) : undefined;
  if (startDate && until <= startDate) {
    return `The last date must be after the first date (${longDate(startDate)}).`;
  }
  return true;
}

/** "Only some membership levels" needs at least one level ticked. */
export function visibilityLevelsRule(
  levels: string[] | undefined,
  context: ValidationContext,
): RuleResult {
  const audience = (context.parent as { audience?: string } | undefined)?.audience;
  if (audience !== "levels" || (levels && levels.length > 0)) return true;
  return "Tick at least one membership level, or choose who can see this above.";
}

/** Every uploaded image needs alt text. */
export function imageAltRule(alt: string | undefined, context: ValidationContext): RuleResult {
  const asset = (context.parent as { asset?: unknown } | undefined)?.asset;
  if (!asset || alt?.trim()) return true;
  return "Describe the image for people who can't see it.";
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A web address that works in a URL. Sanity's slug type already rejects one that another document
 * of the same type uses; `reserved` lists addresses that belong to the app's own routes.
 */
export function slugRule(reserved: readonly string[] = []) {
  return (slug: SlugValue | undefined): RuleResult => {
    const current = slug?.current;
    // A missing web address is reported by rule.required().
    if (!current) return true;
    if (!SLUG_PATTERN.test(current)) {
      return "Use only lowercase letters, numbers and hyphens, like fall-fest-recap. Generate makes one from the title.";
    }
    if (reserved.includes(current)) {
      return `The website already uses /${current} for something else. Choose a different web address.`;
    }
    return true;
  };
}

/** A link: a page on this site (/events), a web address (https://), mailto: or tel:. */
export function hrefRule(href: string | undefined): RuleResult {
  if (href === undefined || href === "") return true;
  const value = href.trim();
  if (/^\/(?!\/)\S*$/.test(value)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) return true;
  if (/^tel:\+?[\d\s().-]{7,}$/i.test(value)) return true;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".")) {
      return true;
    }
  } catch {
    // Not a URL: fall through to the message.
  }
  return "Use a web address that starts with https://, a page on this site that starts with / (like /events), or mailto: and an email address.";
}

/** A link object points at exactly one thing: something in the Studio, or a web address. */
export function linkRule(link: { internal?: unknown; href?: string } | undefined): RuleResult {
  if (!link) return true;
  const hasInternal = Boolean(link.internal);
  const hasHref = Boolean(link.href?.trim());
  if (hasInternal && hasHref) return "Choose a page or type a web address, not both.";
  if (!hasInternal && !hasHref) return "Choose a page or type a web address.";
  return true;
}

type TableValue = { source?: string; columns?: string[]; rows?: { cells?: string[] }[] };

/** A table you type needs column headings (the directory table fills its own). */
export function tableColumnsRule(
  columns: string[] | undefined,
  context: ValidationContext,
): RuleResult {
  if ((context.parent as TableValue | undefined)?.source === "directory") return true;
  return columns && columns.length > 0 ? true : "Add at least one column heading.";
}

/** A table you type needs rows, each with one cell per column. */
export function tableRowsRule(rows: TableValue["rows"], context: ValidationContext): RuleResult {
  const table = context.parent as TableValue | undefined;
  if (table?.source === "directory") return true;
  if (!rows || rows.length === 0) return "Add at least one row.";
  const columns = table?.columns?.length ?? 0;
  const index = rows.findIndex((row) => (row.cells?.length ?? 0) !== columns);
  if (index === -1) return true;
  const cells = rows[index].cells?.length ?? 0;
  return `Row ${index + 1} has ${cells} ${cells === 1 ? "cell" : "cells"}, but the table has ${columns} ${columns === 1 ? "column" : "columns"}. Give every row one cell per column.`;
}

export type VideoProvider = "youtube" | "vimeo" | "bandcamp";

/** Which player a video link plays in, or null if the site can't embed it. */
export function videoProvider(link: string): VideoProvider | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname;
  if (host === "youtu.be") return /^\/[\w-]{6,}$/.test(path) ? "youtube" : null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (path === "/watch" && url.searchParams.get("v")) return "youtube";
    return /^\/(embed|shorts|live)\/[\w-]{6,}$/.test(path) ? "youtube" : null;
  }
  if (host === "vimeo.com") return /^\/\d+(\/\w+)?$/.test(path) ? "vimeo" : null;
  if (host === "player.vimeo.com") return /^\/video\/\d+$/.test(path) ? "vimeo" : null;
  if (host === "bandcamp.com") return path.startsWith("/EmbeddedPlayer/") ? "bandcamp" : null;
  return null;
}

export function videoUrlRule(link: string | undefined): RuleResult {
  if (!link || videoProvider(link)) return true;
  return "Paste the link to a YouTube or Vimeo video, or a Bandcamp player link that starts with https://bandcamp.com/EmbeddedPlayer/.";
}

/** A featured sponsor needs the spotlight text it shows. */
export function spotlightTextRule(
  text: string | undefined,
  context: ValidationContext,
): RuleResult {
  const featured = (context.document as { featured?: unknown } | undefined)?.featured === true;
  if (!featured || text?.trim()) return true;
  return "Write the spotlight text: it shows while this sponsor is featured.";
}

/**
 * Other published sponsors that are featured and haven't ended. Drafts don't count: they aren't on
 * the website. The Studio runs this check when a draft is opened or edited, and Publish reuses the
 * last result unless the draft has changed since. So two sponsors can still both end up featured,
 * for example when one draft sits open, unedited, while the other is published. The website must
 * therefore pick one (P-4).
 */
export const OTHER_FEATURED_SPONSORS_QUERY = `*[_type == "sponsor" && featured == true
  && _id != $publishedId && !(_id in path("drafts.**")) && !(_id in path("versions.**"))
  && (!defined(endsAt) || endsAt >= $today)].name`;

/** Only one sponsor is featured at a time (an ended sponsorship doesn't count). */
export async function featuredSponsorRule(
  featured: boolean | undefined,
  context: ValidationContext,
): Promise<RuleResult> {
  const id = context.document?._id;
  if (featured !== true || !id) return true;
  const names = await context
    .getClient({ apiVersion })
    .fetch<(string | null)[]>(OTHER_FEATURED_SPONSORS_QUERY, {
      publishedId: getPublishedId(id),
      today: dateInSocietyTimeZone(new Date()),
    });
  if (names.length === 0) return true;
  const who = listOf(names.map((name) => name?.trim() || "another sponsor"));
  const several = names.length > 1;
  return `Only one sponsor can be featured at a time, and ${who} ${several ? "are" : "is"} featured now. Turn off Featured there and publish ${several ? "those sponsors" : "that sponsor"} first.`;
}
