// An event as an entry in a calendar file (./ics.ts), for "Add to calendar" and the calendar feed
// (backlog P-2). The event is read through sanity/content, so for a viewer who may not see a
// members-only event the entry has only its public fields: no place and no description, just a
// note that it's for members (decision 0001).
import { stegaClean } from "next-sanity";
import type { GatedItem } from "@/sanity/content";
import { eventPath } from "@/sanity/paths";
import { EVENT_CATEGORIES, optionTitle } from "@/sanity/schemas/options";
import type { CalendarEntry } from "./ics";
import { readSchedule } from "./occurrences";

/** The members-only fields a calendar entry uses: the description and where. */
export const CALENDAR_CONTENT = '{ body, "venue": venue->{ name, address } }';

export type CalendarContent = {
  body?: unknown;
  venue?: { name?: unknown; address?: unknown } | null;
};

/** The entry for an event, with links to `origin` (https://<site>); null if it has no start. */
export function calendarEntry(
  event: GatedItem<"event", CalendarContent>,
  origin: string,
): CalendarEntry | null {
  const { frequency, until } = (event.recurrence ?? {}) as { frequency?: unknown; until?: unknown };
  const schedule = readSchedule(clean(event.start), {
    frequency: clean(frequency),
    until: clean(until),
  });
  if (!schedule) return null;

  const url = new URL(eventPath(event.slug), origin).href;
  const title = clean(event.title) || "Untitled event";
  const price = priceLine(clean(event.priceText), clean(event.memberPrice));
  const content = event.access.allowed ? event.content : null;
  const location = [clean(content?.venue?.name), clean(content?.venue?.address)]
    .filter(Boolean)
    .join(", ");
  const description = event.access.allowed
    ? [price, plainText(content?.body), `More: ${url}`]
    : ["For members. Sign in on the website for the place and details.", price, url];
  const updatedAt = event._updatedAt ? new Date(event._updatedAt) : null;

  return {
    uid: `${event._id}@${new URL(origin).hostname}`,
    title: event.access.allowed ? title : `${title} (members only)`,
    schedule,
    url,
    location: location || null,
    description: description.filter(Boolean).join("\n\n"),
    category: optionTitle(EVENT_CATEGORIES, clean(event.category)) || null,
    updatedAt,
  };
}

/** "$15 · Members $10", as event cards write the prices. */
export function priceLine(price: string, memberPrice: string): string {
  return [price, memberPrice && `Members ${memberPrice}`].filter(Boolean).join(" · ");
}

/** A value as plain text: a preview's edit markers removed, trimmed; "" if it isn't text. */
function clean(value: unknown): string {
  return typeof value === "string" ? stegaClean(value).trim() : "";
}

/** The text of Portable Text paragraphs and list items, one per line; photos and videos left out. */
function plainText(body: unknown): string {
  if (!Array.isArray(body)) return "";
  return body
    .flatMap((block: { _type?: unknown; listItem?: unknown; children?: unknown }) => {
      if (block?._type !== "block" || !Array.isArray(block.children)) return [];
      const line = block.children
        .map((child: { text?: unknown }) => (typeof child?.text === "string" ? child.text : ""))
        .join("");
      const text = clean(line);
      return text ? [block.listItem ? `• ${text}` : text] : [];
    })
    .join("\n");
}
