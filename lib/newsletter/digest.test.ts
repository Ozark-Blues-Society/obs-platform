// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listQuery } from "@/sanity/content/gated-query";

const mocks = vi.hoisted(() => ({ listPublicItems: vi.fn(), getRoles: vi.fn() }));
vi.mock("@/sanity/content", () => ({ listPublicItems: mocks.listPublicItems }));
vi.mock("@/lib/auth/user", () => ({ getRoles: mocks.getRoles }));

const { DIGEST_CONTENT, DIGEST_FILTER, DIGEST_ORDER, digestParams, loadDigestPosts, makesDigest } =
  await import("./digest");

beforeEach(() => {
  vi.clearAllMocks();
});

/** A post as Sanity stores it. */
const stored = (id: string, publishedAt: string | undefined, fields: object = {}) => ({
  _id: id,
  _type: "post",
  title: id,
  slug: { _type: "slug", current: id },
  category: "recap",
  excerpt: `The summary of ${id}`,
  visibility: { _type: "visibility", audience: "everyone" },
  includeInDigest: true,
  publishedAt,
  ...fields,
});

describe("the digest query", () => {
  // November 2026 on the Society's calendar: from 05:00 UTC on Nov 1 (midnight, daylight saving
  // time) to 06:00 UTC on Dec 1 (midnight, standard time).
  const run = async (now: string) => {
    const query = listQuery("post", DIGEST_CONTENT, { filter: DIGEST_FILTER, order: DIGEST_ORDER });
    const dataset = [
      stored("first-minute", "2026-11-01T05:00:00Z"),
      stored("october", "2026-11-01T04:59:59.999Z"),
      stored("mid-month", "2026-11-14T15:00:00.000Z"),
      stored("members", "2026-11-12T18:00:00Z", {
        visibility: { _type: "visibility", audience: "members" },
      }),
      stored("last-minute", "2026-12-01T05:59:59Z"),
      stored("december", "2026-12-01T06:00:00Z"),
      stored("not-marked", "2026-11-10T12:00:00Z", { includeInDigest: false }),
      stored("never-marked", "2026-11-10T12:00:00Z", { includeInDigest: undefined }),
      stored("no-date", undefined),
    ];
    const params = { ...digestParams("2026-11", new Date(now)), memberLevel: null };
    const result = await (await evaluate(parse(query), { dataset, params })).get();
    return (result as { _id: string; content: unknown }[]).map((post) => [post._id, post.content]);
  };

  it("takes the month's marked posts, latest first, without a members-only post's summary", async () => {
    expect(await run("2026-12-02T12:00:00Z")).toEqual([
      ["last-minute", { excerpt: "The summary of last-minute" }],
      ["mid-month", { excerpt: "The summary of mid-month" }],
      ["members", null],
      ["first-minute", { excerpt: "The summary of first-minute" }],
    ]);
  });

  it("leaves out posts that aren't published yet", async () => {
    expect((await run("2026-11-14T15:00:00Z")).map(([id]) => id)).toEqual([
      "mid-month",
      "members",
      "first-minute",
    ]);
  });
});

/** A post as listPublicItems returns it. */
const item = (fields: object = {}) => ({
  _id: "post-1",
  _type: "post",
  slug: "fall-fest-recap",
  title: " Fall Fest recap ",
  category: "recap",
  publishedAt: "2026-11-20T16:00:00Z",
  visibility: { audience: "everyone", levels: [] },
  access: { allowed: true },
  content: { excerpt: " Highlights from the weekend. " },
  ...fields,
});

describe("loadDigestPosts", () => {
  it("asks for the month's posts as a visitor sees them", async () => {
    mocks.listPublicItems.mockResolvedValue([]);
    const now = new Date("2026-11-26T18:00:00Z");
    await loadDigestPosts("2026-11", now);
    expect(mocks.listPublicItems).toHaveBeenCalledWith("post", "{ excerpt }", {
      filter: DIGEST_FILTER,
      order: DIGEST_ORDER,
      params: {
        start: "2026-11-01T05:00:00.000Z",
        end: "2026-12-01T06:00:00.000Z",
        now: "2026-11-26T18:00:00.000Z",
      },
    });
  });

  it("turns posts into the newsletter's, and a locked post never has a summary", async () => {
    mocks.listPublicItems.mockResolvedValue([
      item(),
      item({
        _id: "post-2",
        slug: "board-notes",
        title: "Board notes",
        category: "society-news",
        visibility: { audience: "members", levels: [] },
        access: { allowed: false, reason: "sign-in" },
        // listPublicItems never returns this for a locked post; even so it's left out.
        content: { excerpt: "Members-only summary" },
      }),
      item({ _id: "post-3", slug: "no-summary", category: undefined, content: { excerpt: " " } }),
      item({ _id: "post-4", title: "  " }),
      item({ _id: "post-5", publishedAt: undefined }),
    ]);
    await expect(loadDigestPosts("2026-11", new Date())).resolves.toEqual([
      {
        title: "Fall Fest recap",
        slug: "fall-fest-recap",
        category: "Recap",
        publishedAt: "2026-11-20T16:00:00Z",
        membersOnly: false,
        summary: "Highlights from the weekend.",
      },
      {
        title: "Board notes",
        slug: "board-notes",
        category: "Society News",
        publishedAt: "2026-11-20T16:00:00Z",
        membersOnly: true,
        summary: null,
      },
      {
        title: "Fall Fest recap",
        slug: "no-summary",
        category: "",
        publishedAt: "2026-11-20T16:00:00Z",
        membersOnly: false,
        summary: null,
      },
    ]);
  });
});

describe("makesDigest", () => {
  it("is for editors and administrators", async () => {
    const cases: [string[], boolean][] = [
      [["editor"], true],
      [["admin"], true],
      [["moderator", "editor"], true],
      [["membership_manager", "moderator"], false],
      [[], false],
    ];
    for (const [roles, expected] of cases) {
      mocks.getRoles.mockResolvedValue(roles);
      expect(await makesDigest("00000000-0000-4000-8100-000000000001"), roles.join()).toBe(
        expected,
      );
    }
  });
});
