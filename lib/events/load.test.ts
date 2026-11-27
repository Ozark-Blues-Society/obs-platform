// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthRange } from "@/lib/society-time";

const mocks = vi.hoisted(() => ({ listGatedItems: vi.fn() }));
vi.mock("@/sanity/content", () => ({ listGatedItems: mocks.listGatedItems }));

const { EVENT_LIST_CONTENT, EVENT_WINDOW_FILTER, loadEventOccurrences, loadUpcomingEvents } =
  await import("./load");

/** Appends an invisible edit marker, as Sanity's stega encoding does in a preview. */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

/** An event as sanity/content's listGatedItems returns it. */
function listed(id: string, fields: Record<string, unknown> = {}, locked = false) {
  return {
    _id: id,
    _type: "event",
    slug: id,
    visibility: { audience: locked ? "members" : "everyone", levels: [] },
    access: locked ? { allowed: false, reason: "sign-in" } : { allowed: true },
    title: `Event ${id}`,
    start: "2026-12-05T02:00:00Z",
    recurrence: { frequency: "none" },
    category: "concert",
    priceText: "$15",
    memberPrice: "$10",
    content: locked ? null : { venue: { name: "Old Mill Music Hall" } },
    ...fields,
  };
}

const DECEMBER = monthRange("2026-12");

beforeEach(() => {
  mocks.listGatedItems.mockReset();
  mocks.listGatedItems.mockResolvedValue([]);
});

describe("the window filter", () => {
  // Run with groq-js, Sanity's own GROQ engine: which events December 2026 asks Sanity for.
  const event = (id: string, start: unknown, recurrence?: object) => ({
    _id: id,
    _type: "event",
    start,
    recurrence,
  });
  const dataset = [
    event("one-off-in", "2026-12-12T02:00:00Z", { frequency: "none" }),
    event("one-off-at-start", DECEMBER.start.toISOString()),
    event("one-off-at-end", DECEMBER.end.toISOString()),
    event("one-off-before", "2026-11-28T02:00:00Z"),
    event("weekly-ongoing", "2026-09-01T00:00:00Z", { frequency: "weekly", until: "2027-03-31" }),
    event("weekly-to-first", "2026-09-01T00:00:00Z", { frequency: "weekly", until: "2026-12-01" }),
    event("weekly-ended", "2026-09-01T00:00:00Z", { frequency: "weekly", until: "2026-11-30" }),
    event("weekly-no-last-date", "2026-09-01T00:00:00Z", { frequency: "weekly" }),
    event("monthly-ongoing", "2026-01-02T01:00:00Z", { frequency: "monthly", until: "2027-01-31" }),
    event("not-repeating-earlier", "2026-09-01T00:00:00Z", {
      frequency: "none",
      until: "2027-01-31",
    }),
    event("weekly-later", "2027-01-05T00:00:00Z", { frequency: "weekly", until: "2027-03-31" }),
    event("no-start", undefined, { frequency: "weekly" }),
  ];

  it("asks for events that start in the month, and repeating ones still going", async () => {
    const query = `*[_type == "event" && (${EVENT_WINDOW_FILTER})]._id`;
    const params = {
      from: DECEMBER.start.toISOString(),
      to: DECEMBER.end.toISOString(),
      fromDate: "2026-12-01",
    };
    const ids = await (await evaluate(parse(query), { dataset, params })).get();
    expect([...ids].sort()).toEqual([
      "monthly-ongoing",
      "one-off-at-start",
      "one-off-in",
      "weekly-no-last-date",
      "weekly-ongoing",
      "weekly-to-first",
    ]);
  });
});

describe("loadEventOccurrences", () => {
  it("reads events through sanity/content, venue in the members-only part", async () => {
    await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(mocks.listGatedItems).toHaveBeenCalledWith("event", EVENT_LIST_CONTENT, {
      filter: EVENT_WINDOW_FILTER,
      order: "start asc",
      params: {
        from: "2026-12-01T06:00:00.000Z",
        to: "2027-01-01T06:00:00.000Z",
        fromDate: "2026-12-01",
      },
    });
    expect(EVENT_LIST_CONTENT).toBe('{ "venue": venue->{ name } }');
  });

  it("lists every date in the window, earliest first, each with its own key", async () => {
    mocks.listGatedItems.mockResolvedValue([
      listed("revue", { start: "2026-12-11T01:30:00Z", category: "concert" }),
      listed("jam", {
        start: "2026-11-25T01:00:00Z", // Tuesdays at 7 PM
        recurrence: { frequency: "weekly", until: "2026-12-15" },
        category: "jam",
        priceText: "Free",
        memberPrice: null,
      }),
    ]);
    const dates = await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(dates.map((date) => [date.key, date.startsAt])).toEqual([
      ["jam@2026-12-02T01:00:00.000Z", "2026-12-02T01:00:00.000Z"],
      ["jam@2026-12-09T01:00:00.000Z", "2026-12-09T01:00:00.000Z"],
      ["revue@2026-12-11T01:30:00.000Z", "2026-12-11T01:30:00.000Z"],
      ["jam@2026-12-16T01:00:00.000Z", "2026-12-16T01:00:00.000Z"],
    ]);
    expect(dates[0]).toEqual({
      key: "jam@2026-12-02T01:00:00.000Z",
      eventId: "jam",
      href: "/events/jam",
      slug: "jam",
      title: "Event jam",
      startsAt: "2026-12-02T01:00:00.000Z",
      category: "jam",
      categoryTitle: "Jam",
      repeats: "weekly",
      membersOnly: false,
      locked: false,
      venue: "Old Mill Music Hall",
      priceText: "Free",
      memberPrice: null,
    });
  });

  it("gives a locked event no venue, and marks it", async () => {
    mocks.listGatedItems.mockResolvedValue([listed("social", {}, true)]);
    const [date] = await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(date).toMatchObject({
      membersOnly: true,
      locked: true,
      venue: null,
      title: "Event social",
    });
  });

  it("marks a members-only event the viewer may see, venue and all", async () => {
    mocks.listGatedItems.mockResolvedValue([
      { ...listed("meeting"), visibility: { audience: "members", levels: [] } },
    ]);
    const [date] = await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(date).toMatchObject({ membersOnly: true, locked: false, venue: "Old Mill Music Hall" });
  });

  it("reads a preview's values without their edit markers, and keeps them on the text", async () => {
    const title = withEditMarker("Winter Blues Revue");
    mocks.listGatedItems.mockResolvedValue([
      listed("revue", {
        title,
        category: withEditMarker("workshop"),
        start: "2026-11-25T01:00:00Z",
        recurrence: { frequency: withEditMarker("weekly"), until: withEditMarker("2026-12-08") },
      }),
    ]);
    const dates = await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(dates.map((date) => date.startsAt)).toEqual([
      "2026-12-02T01:00:00.000Z",
      "2026-12-09T01:00:00.000Z", // Tuesday, December 8: the last date
    ]);
    expect(dates[0]).toMatchObject({ title, category: "workshop", repeats: "weekly" });
  });

  it("skips an event without a start, and names one without a title", async () => {
    mocks.listGatedItems.mockResolvedValue([
      listed("draft", { start: undefined }),
      listed("untitled", { title: "  ", category: undefined, priceText: "" }),
    ]);
    const dates = await loadEventOccurrences(DECEMBER.start, DECEMBER.end);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toMatchObject({
      eventId: "untitled",
      title: "Untitled event",
      category: null,
      categoryTitle: null,
      priceText: null,
    });
  });
});

describe("loadUpcomingEvents", () => {
  const jam = listed("jam", {
    start: "2026-11-25T01:00:00Z", // Tuesdays at 7 PM
    recurrence: { frequency: "weekly", until: "2027-02-23" },
    category: "jam",
  });
  const revue = listed("revue", { start: "2026-12-11T01:30:00Z" }); // Thursday, December 10

  it("asks Sanity the same question all day: from midnight less two hours, for a year", async () => {
    await loadUpcomingEvents(new Date("2026-12-01T15:00:00Z"));
    await loadUpcomingEvents(new Date("2026-12-02T05:59:00Z")); // 11:59 PM the same day
    const asked = mocks.listGatedItems.mock.calls.map((call) => call[2].params);
    expect(asked[0]).toEqual({
      from: "2026-12-01T04:00:00.000Z",
      to: "2027-12-01T06:00:00.000Z",
      fromDate: "2026-11-30",
    });
    expect(asked[1]).toEqual(asked[0]);
  });

  it("drops the dates that are over and keeps one in progress", async () => {
    mocks.listGatedItems.mockResolvedValue([jam, revue]);
    // 8:30 PM on Tuesday, December 8: that evening's jam started at 7 and runs to 9.
    const dates = await loadUpcomingEvents(new Date("2026-12-09T02:30:00Z"), { count: 3 });
    expect(dates.map((date) => date.key)).toEqual([
      "jam@2026-12-09T01:00:00.000Z",
      "revue@2026-12-11T01:30:00.000Z",
      "jam@2026-12-16T01:00:00.000Z",
    ]);
  });

  it("can keep each event's next date only, and keep all of them", async () => {
    mocks.listGatedItems.mockResolvedValue([jam, revue]);
    const now = new Date("2026-12-01T15:00:00Z");
    const once = await loadUpcomingEvents(now, { eachEventOnce: true });
    expect(once.map((date) => date.key)).toEqual([
      "jam@2026-12-02T01:00:00.000Z",
      "revue@2026-12-11T01:30:00.000Z",
    ]);
    // The revue, and the jam's 13 Tuesdays up to its last date, February 23.
    expect(await loadUpcomingEvents(now)).toHaveLength(14);
  });
});
