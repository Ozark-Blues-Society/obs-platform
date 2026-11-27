// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";
import { itemQuery, listQuery } from "@/sanity/content/gated-query";
import {
  POST_CONTENT,
  POST_LIST_CONTENT,
  POST_LIST_ORDER,
  POSTS_PER_PAGE,
  blogCategory,
  blogHref,
  blogPageNumber,
  blogTitle,
  isPublished,
  postAuthor,
  postBody,
  postCategory,
  postCover,
  postExcerpt,
  postTitle,
  publishTime,
  selectBlogPage,
} from "./posts";

/**
 * `text` as a preview sends it: followed by invisible edit markers (stega), which @sanity/client
 * encodes as four zero-width characters, then each byte of some JSON as four base-4 digits.
 */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

const NOW = new Date("2026-11-27T18:00:00Z");
const ASSET = "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x1125-jpg";

describe("isPublished", () => {
  it("is true from the publish date on, and false before it: a scheduled post", () => {
    expect(isPublished("2026-11-27T17:59:59Z", NOW)).toBe(true);
    expect(isPublished("2026-11-27T18:00:00.000Z", NOW)).toBe(true);
    expect(isPublished("2026-11-27T18:00:01Z", NOW)).toBe(false);
    expect(isPublished("2027-01-01T00:00:00Z", NOW)).toBe(false);
  });

  it("is false for a post with no publish date, or one that doesn't read as a date", () => {
    for (const value of [undefined, null, "", "soon", 1795798864, {}]) {
      expect(isPublished(value, NOW)).toBe(false);
      expect(publishTime(value)).toBeNull();
    }
  });

  it("reads a preview's date through its edit markers", () => {
    expect(isPublished(withEditMarker("2026-11-20T15:00:00Z"), NOW)).toBe(true);
    expect(isPublished(withEditMarker("2026-12-20T15:00:00Z"), NOW)).toBe(false);
  });
});

describe("the blog's web addresses", () => {
  it("picks a category from ?category=, or every post for none or an unknown one", () => {
    expect(blogCategory("recap")).toBe("recap");
    expect(blogCategory("band-spotlight")).toBe("band-spotlight");
    expect(blogCategory(["education", "recap"])).toBe("education");
    for (const value of [undefined, "", "Recap", "jam", "society news", []]) {
      expect(blogCategory(value)).toBeNull();
    }
  });

  it("reads ?page= as a whole number from 1, and anything else as the first page", () => {
    expect(blogPageNumber("2")).toBe(2);
    expect(blogPageNumber(["3", "1"])).toBe(3);
    for (const value of [undefined, "", "0", "-1", "1.5", "02", "two", "1e3", "9999999"]) {
      expect(blogPageNumber(value)).toBe(1);
    }
  });

  it("writes the address of a category and page, leaving out what's the default", () => {
    expect(blogHref(null)).toBe("/blog");
    expect(blogHref(null, 1)).toBe("/blog");
    expect(blogHref("recap")).toBe("/blog?category=recap");
    expect(blogHref(null, 2)).toBe("/blog?page=2");
    expect(blogHref("society-news", 3)).toBe("/blog?category=society-news&page=3");
  });

  it("names the category and page in the tab title", () => {
    expect(blogTitle(null, 1)).toBe("Blog · Ozark Blues Society");
    expect(blogTitle("band-spotlight", 1)).toBe("Band Spotlight · Blog · Ozark Blues Society");
    expect(blogTitle(null, 2)).toBe("Page 2 · Blog · Ozark Blues Society");
    expect(blogTitle("recap", 3)).toBe("Recap, page 3 · Blog · Ozark Blues Society");
  });
});

describe("selectBlogPage", () => {
  const post = (id: string, publishedAt: unknown, category: unknown = "recap") => ({
    _id: id,
    category,
    publishedAt,
  });
  const ids = (posts: { _id: string }[]) => posts.map((each) => each._id);

  it("leaves out scheduled posts and posts without a date, and keeps the list's order", () => {
    const posts = [
      post("scheduled", "2026-12-01T15:00:00Z"),
      post("today", "2026-11-27T15:00:00Z"),
      post("undated", undefined),
      post("older", "2026-10-14T15:00:00Z"),
    ];
    const page = selectBlogPage(posts, { category: null, page: 1, now: NOW, preview: false });
    expect(ids(page.posts)).toEqual(["today", "older"]);
    expect(page).toMatchObject({ total: 2, page: 1, pageCount: 1 });
  });

  it("shows a preview the scheduled posts too, but still not one without a date", () => {
    const posts = [
      post("scheduled", "2026-12-01T15:00:00Z"),
      post("undated", ""),
      post("older", "2026-10-14T15:00:00Z"),
    ];
    const page = selectBlogPage(posts, { category: null, page: 1, now: NOW, preview: true });
    expect(ids(page.posts)).toEqual(["scheduled", "older"]);
  });

  it("keeps only the picked category, reading a preview's value through its edit markers", () => {
    const posts = [
      post("recap", "2026-11-01T15:00:00Z", "recap"),
      post("news", "2026-11-02T15:00:00Z", "society-news"),
      post("marked", "2026-11-03T15:00:00Z", withEditMarker("society-news")),
      post("none", "2026-11-04T15:00:00Z", undefined),
    ];
    const news = selectBlogPage(posts, {
      category: "society-news",
      page: 1,
      now: NOW,
      preview: false,
    });
    expect(ids(news.posts)).toEqual(["news", "marked"]);
    const all = selectBlogPage(posts, { category: null, page: 1, now: NOW, preview: false });
    expect(all.total).toBe(4);
  });

  it(`shows ${POSTS_PER_PAGE} posts a page, and the last page for one past it`, () => {
    const posts = Array.from({ length: 30 }, (_, index) =>
      post(`p${index + 1}`, new Date(NOW.getTime() - (index + 1) * 60_000).toISOString()),
    );
    const at = (page: number) =>
      selectBlogPage(posts, { category: null, page, now: NOW, preview: false });

    expect(ids(at(1).posts)).toEqual(ids(posts.slice(0, 12)));
    expect(at(1)).toMatchObject({ total: 30, page: 1, pageCount: 3 });
    expect(ids(at(2).posts)).toEqual(ids(posts.slice(12, 24)));
    expect(ids(at(3).posts)).toEqual(ids(posts.slice(24)));
    expect(at(99)).toMatchObject({ page: 3, pageCount: 3 });
    expect(ids(at(99).posts)).toEqual(ids(posts.slice(24)));
    expect(at(0).page).toBe(1);
  });

  it("has one empty page when there are no posts", () => {
    expect(selectBlogPage([], { category: "recap", page: 4, now: NOW, preview: false })).toEqual({
      posts: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });
});

describe("a post's fields", () => {
  it("gives the category's value and title, or only the stored text for an unknown one", () => {
    expect(postCategory("band-spotlight")).toEqual({
      value: "band-spotlight",
      title: "Band Spotlight",
    });
    expect(postCategory(withEditMarker("recap"))).toEqual({ value: "recap", title: "Recap" });
    expect(postCategory("gear")).toEqual({ value: null, title: "gear" });
    expect(postCategory(undefined)).toEqual({ value: null, title: "" });
  });

  it("keeps a preview's edit markers in the headline and summary, which people read", () => {
    const title = withEditMarker("Fall Fest Recap");
    expect(postTitle(title)).toBe(title);
    expect(postTitle(withEditMarker(" "))).toBe("Untitled post");
    expect(postTitle(undefined)).toBe("Untitled post");
    expect(postExcerpt({ excerpt: withEditMarker("Two days.") })).toBe(withEditMarker("Two days."));
    expect(postExcerpt({ excerpt: "  " })).toBeUndefined();
    expect(postExcerpt(null)).toBeUndefined();
  });

  it("gives the cover photo only when it has an image", () => {
    expect(postCover({ _type: "image", asset: { _ref: ASSET }, alt: "The crowd" })).toEqual({
      image: { asset: { _ref: ASSET } },
      alt: "The crowd",
    });
    expect(postCover({ _type: "image", alt: "Not uploaded yet" })).toBeUndefined();
    expect(postCover(undefined)).toBeUndefined();
  });

  it("keeps the post's blocks and drops anything that isn't one", () => {
    const block = { _type: "block", _key: "a", children: [] };
    expect(postBody([block, null, "text", ["nested"], block])).toEqual([block, block]);
    expect(postBody(undefined)).toEqual([]);
    expect(postBody({ _type: "block" })).toEqual([]);
  });

  it("gives the author's name, role, bio and photo, and no author without a name", () => {
    const photo = { _type: "image", asset: { _ref: ASSET }, alt: "Dee Harmon" };
    expect(
      postAuthor({
        name: "Dee Harmon",
        role: "Volunteer coordinator",
        bio: "Twelve years.",
        photo,
      }),
    ).toEqual({
      name: "Dee Harmon",
      role: "Volunteer coordinator",
      bio: "Twelve years.",
      photo: { image: { asset: { _ref: ASSET } }, alt: "Dee Harmon" },
    });
    expect(postAuthor({ name: "Communications Team", photo: { alt: "No image" } })).toEqual({
      name: "Communications Team",
      role: undefined,
      bio: undefined,
      photo: undefined,
    });
    expect(postAuthor({ role: "Treasurer" })).toBeUndefined();
    expect(postAuthor(null)).toBeUndefined();
  });
});

describe("the blog's GROQ, run with groq-js", () => {
  const MEMBERS_ONLY = "MEMBERS-ONLY";
  const person = {
    _id: "person-dee",
    _type: "person",
    name: "Dee Harmon",
    role: "Volunteer coordinator",
    bio: "Twelve years at the door table.",
    photo: { _type: "image", asset: { _type: "reference", _ref: ASSET }, alt: "Dee Harmon" },
    boardMember: true,
    boardOrder: 4,
  };
  const post = (id: string, publishedAt: string, audience: string, extra: object = {}) => ({
    _id: id,
    _type: "post",
    title: `Post ${id}`,
    slug: { _type: "slug", current: id },
    category: "society-news",
    coverImage: { _type: "image", asset: { _type: "reference", _ref: ASSET }, alt: "Cover" },
    excerpt: `${MEMBERS_ONLY}: the summary of ${id}`,
    body: [{ _type: "block", _key: "b", children: [{ _type: "span", text: `${id} in full` }] }],
    author: { _type: "reference", _ref: "person-dee" },
    visibility: { _type: "visibility", audience },
    publishedAt,
    ...extra,
  });
  const membersPost = post("members", "2026-11-25T15:00:00Z", "members");
  const dataset = [
    person,
    post("b-tie", "2026-11-20T15:00:00Z", "everyone"),
    post("a-tie", "2026-11-20T15:00:00Z", "everyone"),
    membersPost,
    post("oldest", "2026-10-01T15:00:00Z", "everyone"),
  ];

  async function run(query: string, params: Record<string, unknown>) {
    const value = await evaluate(parse(query), { dataset, params });
    return value.get();
  }

  it("lists posts latest first, ties in id order, a locked one without its summary", async () => {
    const query = listQuery("post", POST_LIST_CONTENT, { order: POST_LIST_ORDER });
    const posts = (await run(query, { memberLevel: null })) as Record<string, unknown>[];
    expect(posts.map((each) => each._id)).toEqual(["members", "a-tie", "b-tie", "oldest"]);
    expect(posts[0]).toMatchObject({ locked: true, content: null, title: "Post members" });
    expect(posts[1]).toMatchObject({
      locked: false,
      content: { excerpt: `${MEMBERS_ONLY}: the summary of a-tie` },
    });
    // A card reads nothing else: no post text, and no author.
    expect(JSON.stringify(posts)).not.toContain("in full");
    expect(JSON.stringify(posts)).not.toContain("Dee Harmon");
    expect(JSON.stringify(posts[0])).not.toContain(MEMBERS_ONLY);

    const member = (await run(query, { memberLevel: "individual" })) as Record<string, unknown>[];
    expect(member[0]).toMatchObject({
      locked: false,
      content: { excerpt: `${MEMBERS_ONLY}: the summary of members` },
    });
  });

  it("gives a reader the post, the author's listed fields only, and the files", async () => {
    const query = itemQuery("post", POST_CONTENT);
    const item = (await run(query, { slug: "members", memberLevel: "band" })) as {
      content: Record<string, unknown>;
    };
    expect(item.content.excerpt).toBe(`${MEMBERS_ONLY}: the summary of members`);
    expect(item.content.body).toEqual(membersPost.body);
    expect(item.content.author).toEqual({
      name: person.name,
      role: person.role,
      bio: person.bio,
      photo: person.photo,
    });
    expect(postAuthor(item.content.author)?.name).toBe("Dee Harmon");
  });

  it("gives a visitor a members-only post's public fields and nothing else", async () => {
    const query = itemQuery("post", POST_CONTENT);
    const item = (await run(query, { slug: "members", memberLevel: null })) as Record<
      string,
      unknown
    >;
    expect(item).toMatchObject({
      title: "Post members",
      category: "society-news",
      publishedAt: "2026-11-25T15:00:00Z",
      locked: true,
      content: null,
    });
    expect(JSON.stringify(item)).not.toContain(MEMBERS_ONLY);
    expect(JSON.stringify(item)).not.toContain("in full");
    expect(JSON.stringify(item)).not.toContain("Dee Harmon");
  });
});
