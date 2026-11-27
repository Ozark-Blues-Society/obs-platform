// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { GatedItem } from "@/sanity/content";
import { calendarEntry, priceLine, type CalendarContent } from "./calendar-entry";

const ORIGIN = "https://ozarkblues.example";
const SECRET = "Members-only text";

/** Appends an invisible edit marker, as Sanity's stega encoding does in a preview. */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

const block = (text: string, listItem?: string) => ({
  _type: "block",
  ...(listItem ? { listItem } : {}),
  children: [{ _type: "span", text }],
});

function event(
  locked: boolean,
  fields: Partial<GatedItem<"event", CalendarContent>> = {},
): GatedItem<"event", CalendarContent> {
  return {
    _id: "fixture-event-delta-night",
    _type: "event",
    _updatedAt: "2026-11-20T10:00:00Z",
    slug: "delta-night",
    visibility: { audience: locked ? "members" : "everyone", levels: [] },
    access: locked ? { allowed: false, reason: "sign-in" } : { allowed: true },
    title: "Delta Night",
    start: "2026-12-05T02:00:00Z",
    recurrence: { frequency: "none" },
    category: "concert",
    priceText: "$15",
    memberPrice: "$10",
    content: locked
      ? null
      : {
          body: [
            block("Hill-country grooves."),
            block("Doors at 7", "bullet"),
            { _type: "videoBlock" },
          ],
          venue: { name: "Old Mill Music Hall", address: "410 Mill Street, Riverbend" },
        },
    ...fields,
  };
}

describe("calendarEntry", () => {
  it("gives a viewer who may see the event its place and description", () => {
    expect(calendarEntry(event(false), ORIGIN)).toEqual({
      uid: "fixture-event-delta-night@ozarkblues.example",
      title: "Delta Night",
      schedule: { start: new Date("2026-12-05T02:00:00Z"), repeat: null },
      url: "https://ozarkblues.example/events/delta-night",
      location: "Old Mill Music Hall, 410 Mill Street, Riverbend",
      description:
        "$15 · Members $10\n\nHill-country grooves.\n• Doors at 7\n\nMore: https://ozarkblues.example/events/delta-night",
      category: "Concert",
      updatedAt: new Date("2026-11-20T10:00:00Z"),
    });
  });

  it("gives a locked event its public fields only, and says it's for members", () => {
    // Even if content came along by mistake, a locked entry doesn't use it.
    const locked = event(true, { content: { body: [block(SECRET)], venue: { name: SECRET } } });
    const entry = calendarEntry(locked, ORIGIN);
    expect(entry).toMatchObject({
      title: "Delta Night (members only)",
      location: null,
      description:
        "For members. Sign in on the website for the place and details.\n\n$15 · Members $10\n\nhttps://ozarkblues.example/events/delta-night",
    });
    expect(JSON.stringify(entry)).not.toContain(SECRET);
  });

  it("reads a preview's values without edit markers, and repeats as the event does", () => {
    const entry = calendarEntry(
      event(false, {
        title: withEditMarker("Weekly Open Jam"),
        category: withEditMarker("jam"),
        recurrence: { frequency: withEditMarker("weekly"), until: "2027-03-30" },
        priceText: withEditMarker("Free"),
        memberPrice: "",
      }),
      ORIGIN,
    );
    expect(entry).toMatchObject({
      title: "Weekly Open Jam",
      category: "Jam",
      schedule: { repeat: { frequency: "weekly", until: "2027-03-30" } },
    });
    expect(entry?.description?.startsWith("Free\n\n")).toBe(true);
  });

  it("skips an event without a start", () => {
    expect(calendarEntry(event(false, { start: undefined }), ORIGIN)).toBeNull();
  });
});

describe("priceLine", () => {
  it("writes the prices as event cards do", () => {
    expect(priceLine("$15", "$10")).toBe("$15 · Members $10");
    expect(priceLine("Free", "")).toBe("Free");
    expect(priceLine("", "$5")).toBe("Members $5");
    expect(priceLine("", "")).toBe("");
  });
});
