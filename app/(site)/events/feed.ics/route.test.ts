// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPublicItems: vi.fn() }));
vi.mock("@/sanity/content", () => ({ listPublicItems: mocks.listPublicItems }));

const { GET } = await import("./route");
const { CALENDAR_CONTENT } = await import("@/lib/events/calendar-entry");
const { EVENT_WINDOW_FILTER } = await import("@/lib/events/load");

const SECRET = "Members-only text";

function event(id: string, locked: boolean, fields: object = {}) {
  return {
    _id: id,
    _type: "event",
    _updatedAt: "2026-11-20T10:00:00Z",
    slug: id,
    visibility: { audience: locked ? "members" : "everyone", levels: [] },
    access: locked ? { allowed: false, reason: "sign-in" } : { allowed: true },
    title: `Event ${id}`,
    start: "2026-12-05T02:00:00Z",
    recurrence: { frequency: "none" },
    category: "concert",
    content: locked ? null : { venue: { name: "Old Mill Music Hall" } },
    ...fields,
  };
}

const get = () => GET(new Request("http://127.0.0.1:3000/events/feed.ics"));

beforeEach(() => {
  mocks.listPublicItems.mockReset();
  mocks.listPublicItems.mockResolvedValue([]);
  vi.stubEnv("SITE_URL", "https://ozarkblues.example");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T17:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /events/feed.ics", () => {
  it("reads events as a visitor sees them, from 30 days back to two years ahead, the same all day", async () => {
    await get();
    expect(mocks.listPublicItems).toHaveBeenCalledWith("event", CALENDAR_CONTENT, {
      filter: EVENT_WINDOW_FILTER,
      order: "start asc",
      params: {
        // Midnight in Central Time on October 28, 2026 and on November 27, 2028.
        from: "2026-10-28T05:00:00.000Z",
        to: "2028-11-27T06:00:00.000Z",
        fromDate: "2026-10-28",
      },
    });
  });

  it("sends a calendar every app can subscribe to, which shared caches may keep", async () => {
    mocks.listPublicItems.mockResolvedValue([
      event("revue", false),
      event("jam", false, { recurrence: { frequency: "weekly", until: "2027-03-30" } }),
      // Locked for a visitor, which the feed always reads as; stray content must not show either.
      { ...event("social", true), content: { venue: { name: SECRET } } },
      event("draft", false, { start: undefined }),
    ]);
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    const file = await response.text();
    expect(file).toContain("X-WR-CALNAME:Ozark Blues Society events\r\n");
    expect(file).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H\r\n");
    expect(file.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(file).toContain("RRULE:FREQ=WEEKLY;UNTIL=20270331T045900Z\r\n");
    expect(file).toContain("SUMMARY:Event social (members only)\r\n");
    expect(file).toContain("URL:https://ozarkblues.example/events/revue\r\n");
    expect(file).not.toContain(SECRET);
  });
});
