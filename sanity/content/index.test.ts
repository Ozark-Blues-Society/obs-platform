// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/members/access";
import { itemQuery, listQuery } from "./gated-query";

const mocks = vi.hoisted(() => ({
  isConfigured: true,
  connection: vi.fn(),
  sanityFetch: vi.fn(),
  getDynamicFetchOptions: vi.fn(),
  getViewer: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
// next-sanity/live only runs in React Server Components (see sanity/live.test.ts).
vi.mock("../live", () => ({
  sanityFetch: mocks.sanityFetch,
  getDynamicFetchOptions: mocks.getDynamicFetchOptions,
}));
vi.mock("../env", () => ({
  get isConfigured() {
    return mocks.isConfigured;
  },
}));
vi.mock("@/lib/members/viewer", () => ({ getViewer: mocks.getViewer }));

const { getGatedItem, listGatedItems } = await import("./index");

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const member = (level: "individual" | "band" | null, expiresAt: string | null): Viewer => ({
  kind: "member",
  userId: "00000000-0000-4000-8100-000000000018",
  level,
  expiresAt,
});
const VISITOR: Viewer = { kind: "visitor" };

/** Sanity's answer for a members-only post, as the query shapes it. */
const membersPost = (locked: boolean, overrides: object = {}) => ({
  _id: "post-1",
  _type: "post",
  _updatedAt: "2026-11-20T10:00:00Z",
  slug: "winter-jam-notes",
  visibility: { audience: "members", levels: null },
  title: "Winter jam notes",
  category: "society-news",
  publishedAt: "2026-11-01T18:00:00Z",
  coverImage: null,
  locked,
  content: locked ? null : { body: "Members-only body" },
  ...overrides,
});

/** Appends an invisible edit marker, as Sanity's stega encoding does in a preview. */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isConfigured = true;
  mocks.getDynamicFetchOptions.mockResolvedValue({ perspective: "published", stega: false });
  mocks.getViewer.mockResolvedValue(VISITOR);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("getGatedItem", () => {
  it("reads nothing without a Sanity project", async () => {
    mocks.isConfigured = false;
    await expect(getGatedItem("post", "winter-jam-notes", "{ body }")).resolves.toBeNull();
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
    expect(mocks.getViewer).not.toHaveBeenCalled();
  });

  it("asks Sanity with the viewer's active level, at request time", async () => {
    const cases: [Viewer, string | null][] = [
      [VISITOR, null],
      [member("band", inDays(30)), "band"],
      [member("individual", inDays(1)), "individual"],
      [member("band", inDays(-1)), null],
      [member(null, null), null],
    ];
    for (const [viewer, memberLevel] of cases) {
      mocks.sanityFetch.mockClear();
      mocks.getViewer.mockResolvedValue(viewer);
      mocks.sanityFetch.mockResolvedValue({ data: null });
      await getGatedItem("post", "winter-jam-notes", "{ body }");
      expect(mocks.sanityFetch).toHaveBeenCalledWith({
        query: itemQuery("post", "{ body }"),
        params: { slug: "winter-jam-notes", memberLevel },
        perspective: "published",
        stega: false,
      });
    }
    expect(mocks.connection).toHaveBeenCalled();
  });

  it("follows the preview's perspective", async () => {
    mocks.getDynamicFetchOptions.mockResolvedValue({ perspective: "drafts", stega: true });
    mocks.sanityFetch.mockResolvedValue({ data: null });
    await getGatedItem("event", "fall-fest", "{ body }");
    expect(mocks.sanityFetch).toHaveBeenCalledWith(
      expect.objectContaining({ perspective: "drafts", stega: true }),
    );
  });

  it("returns the item and its members-only fields to a viewer who can see it", async () => {
    mocks.getViewer.mockResolvedValue(member("individual", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({ data: membersPost(false) });
    await expect(getGatedItem("post", "winter-jam-notes", "{ body }")).resolves.toEqual({
      _id: "post-1",
      _type: "post",
      _updatedAt: "2026-11-20T10:00:00Z",
      slug: "winter-jam-notes",
      visibility: { audience: "members", levels: [] },
      title: "Winter jam notes",
      category: "society-news",
      publishedAt: "2026-11-01T18:00:00Z",
      coverImage: null,
      access: { allowed: true },
      content: { body: "Members-only body" },
    });
  });

  it("returns a locked item with only its public fields, and why it's locked", async () => {
    const cases: [Viewer, string][] = [
      [VISITOR, "sign-in"],
      [member("band", inDays(-14)), "renew"],
      [member(null, null), "join"],
    ];
    for (const [viewer, reason] of cases) {
      mocks.getViewer.mockResolvedValue(viewer);
      mocks.sanityFetch.mockResolvedValue({ data: membersPost(true) });
      const post = await getGatedItem("post", "winter-jam-notes", "{ body }");
      expect(post).toMatchObject({ title: "Winter jam notes", access: { allowed: false, reason } });
      expect(post?.content).toBeNull();
    }
  });

  it("shows nothing members-only if Sanity sends it to a viewer who can't see it", async () => {
    // A mistake in a query must not reach the page: the check here catches it.
    mocks.getViewer.mockResolvedValue(VISITOR);
    mocks.sanityFetch.mockResolvedValue({ data: membersPost(false) });
    const post = await getGatedItem("post", "winter-jam-notes", "{ body }");
    expect(post).toMatchObject({ access: { allowed: false, reason: "sign-in" }, content: null });
    expect(JSON.stringify(post)).not.toContain("Members-only body");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("disagree about post-1"));
  });

  it("shows the item locked if Sanity locks it but checkAccess wouldn't", async () => {
    mocks.getViewer.mockResolvedValue(member("band", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({ data: membersPost(true) });
    const post = await getGatedItem("post", "winter-jam-notes", "{ body }");
    expect(post).toMatchObject({ access: { allowed: false, reason: "level" }, content: null });
    expect(consoleError).toHaveBeenCalled();
  });

  it("checks a preview's values without their edit markers", async () => {
    mocks.getViewer.mockResolvedValue(member("band", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({
      data: membersPost(false, {
        slug: withEditMarker("winter-jam-notes"),
        visibility: { audience: withEditMarker("levels"), levels: [withEditMarker("band")] },
      }),
    });
    const post = await getGatedItem("post", "winter-jam-notes", "{ body }");
    expect(post).toMatchObject({
      slug: "winter-jam-notes",
      visibility: { audience: "levels", levels: ["band"] },
      access: { allowed: true },
      content: { body: "Members-only body" },
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns null for an unknown web address or an answer that isn't the item", async () => {
    for (const data of [null, "post", [], { ...membersPost(true), _type: "page" }]) {
      mocks.sanityFetch.mockResolvedValue({ data });
      await expect(getGatedItem("post", "nope", "{ body }")).resolves.toBeNull();
    }
    mocks.sanityFetch.mockResolvedValue({ data: membersPost(true, { slug: null }) });
    await expect(getGatedItem("post", "nope", "{ body }")).resolves.toBeNull();
  });

  it("refuses members-only fields that aren't a projection", async () => {
    await expect(getGatedItem("post", "x", "body")).rejects.toThrow("GROQ projection in braces");
  });
});

describe("listGatedItems", () => {
  it("reads nothing without a Sanity project", async () => {
    mocks.isConfigured = false;
    await expect(listGatedItems("event", "{ body }")).resolves.toEqual([]);
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
  });

  it("passes the filter's values, but never lets them choose the viewer's level", async () => {
    mocks.sanityFetch.mockResolvedValue({ data: [] });
    const options = { filter: "category == $category", order: "start asc", limit: 3 };
    await listGatedItems("event", "{ body }", {
      ...options,
      params: { category: "jam", memberLevel: "sponsor" },
    });
    expect(mocks.sanityFetch).toHaveBeenCalledWith({
      query: listQuery("event", "{ body }", options),
      params: { category: "jam", memberLevel: null },
      perspective: "published",
      stega: false,
    });
  });

  it("gates each item and skips answers that aren't items of the type", async () => {
    mocks.getViewer.mockResolvedValue(member("individual", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({
      data: [
        membersPost(false),
        membersPost(true, {
          _id: "post-2",
          slug: "band-only",
          visibility: { audience: "levels", levels: ["band"] },
        }),
        { ...membersPost(false), _type: "event" },
        "not an item",
        null,
      ],
    });
    const posts = await listGatedItems("post", "{ body }");
    expect(posts.map((post) => [post._id, post.access, post.content])).toEqual([
      ["post-1", { allowed: true }, { body: "Members-only body" }],
      ["post-2", { allowed: false, reason: "level" }, null],
    ]);
  });

  it("returns nothing when Sanity's answer isn't a list", async () => {
    mocks.sanityFetch.mockResolvedValue({ data: null });
    await expect(listGatedItems("page", "{ blocks }")).resolves.toEqual([]);
  });
});
