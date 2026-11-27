// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getGatedItem: vi.fn() }));
vi.mock("@/sanity/content", () => ({ getGatedItem: mocks.getGatedItem }));

const { GET } = await import("./route");
const { CALENDAR_CONTENT } = await import("@/lib/events/calendar-entry");

const SECRET = "Members-only text";

function event(locked: boolean) {
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
    content: locked
      ? null
      : { body: [{ _type: "block", children: [{ text: SECRET }] }], venue: { name: SECRET } },
  };
}

const get = (slug: string) =>
  GET(new Request(`http://127.0.0.1:3000/events/${slug}/calendar.ics`), {
    params: Promise.resolve({ slug }),
  });

beforeEach(() => {
  mocks.getGatedItem.mockReset();
  vi.stubEnv("SITE_URL", "https://ozarkblues.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /events/<slug>/calendar.ics", () => {
  it("sends the event as a calendar file to download, which no cache keeps", async () => {
    mocks.getGatedItem.mockResolvedValue(event(false));
    const response = await get("delta-night");
    expect(mocks.getGatedItem).toHaveBeenCalledWith("event", "delta-night", CALENDAR_CONTENT);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="delta-night.ics"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const file = await response.text();
    expect(file).toContain("SUMMARY:Delta Night\r\n");
    expect(file).toContain("URL:https://ozarkblues.example/events/delta-night\r\n");
    expect(file).toContain(`LOCATION:${SECRET}`);
  });

  it("gives a viewer who may not see the event its public fields only", async () => {
    mocks.getGatedItem.mockResolvedValue(event(true));
    const file = await (await get("delta-night")).text();
    expect(file).toContain("SUMMARY:Delta Night (members only)");
    expect(file).not.toContain(SECRET);
    expect(file).not.toContain("LOCATION:");
  });

  it("links to the address the request came to without SITE_URL", async () => {
    vi.stubEnv("SITE_URL", "");
    mocks.getGatedItem.mockResolvedValue(event(false));
    const file = await (await get("delta-night")).text();
    expect(file).toContain("URL:http://127.0.0.1:3000/events/delta-night\r\n");
  });

  it("answers 404 for an event that doesn't exist, and doesn't ask Sanity about a bad address", async () => {
    mocks.getGatedItem.mockResolvedValue(null);
    const missing = await get("no-such-event");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("private, no-store");

    mocks.getGatedItem.mockClear();
    expect((await get("Delta_Night")).status).toBe(404);
    expect((await get("..")).status).toBe(404);
    expect(mocks.getGatedItem).not.toHaveBeenCalled();
  });

  it("answers 404 for an event without a start (a draft)", async () => {
    mocks.getGatedItem.mockResolvedValue({ ...event(false), start: undefined });
    expect((await get("delta-night")).status).toBe(404);
  });
});
