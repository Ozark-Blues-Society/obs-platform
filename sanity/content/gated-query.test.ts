// @vitest-environment node
// Runs the gated queries with groq-js, Sanity's own GROQ engine, against a small dataset: proof of
// what each kind of viewer gets back, not just what the query text says.
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";
import { checkAccess, VISITOR, type Viewer } from "@/lib/members/access";
import { MEMBERSHIP_LEVELS, type MembershipLevel } from "../schemas/options";
import {
  CAN_VIEW,
  GATED_TYPES,
  LINK_TARGET,
  PUBLIC_FIELDS,
  gatedProjection,
  isBalancedGroq,
  itemQuery,
  listQuery,
  readsOtherDocuments,
  type GatedType,
} from "./gated-query";

const SECRET = "Members-only text";

type Doc = Record<string, unknown> & { _id: string; _type: string };

/** A post, page and event for one visibility, each holding SECRET in its members-only fields. */
function docsFor(name: string, visibility: object | undefined): Doc[] {
  const common = { _updatedAt: "2026-11-20T10:00:00Z", visibility };
  return [
    {
      ...common,
      _id: `post-${name}`,
      _type: "post",
      slug: { current: `post-${name}` },
      title: `Post ${name}`,
      category: "society-news",
      publishedAt: "2026-11-01T18:00:00Z",
      coverImage: { asset: { _ref: "image-1" }, alt: "Cover" },
      excerpt: `${SECRET}: excerpt`,
      body: [{ _type: "block", children: [{ _type: "span", text: `${SECRET}: body` }] }],
    },
    {
      ...common,
      _id: `page-${name}`,
      _type: "page",
      slug: { current: `page-${name}` },
      title: `Page ${name}`,
      template: "directory",
      blocks: [{ _type: "textBlock", text: `${SECRET}: block` }],
    },
    {
      ...common,
      _id: `event-${name}`,
      _type: "event",
      slug: { current: `event-${name}` },
      title: `Event ${name}`,
      start: "2026-12-05T01:00:00Z",
      recurrence: { frequency: "none" },
      category: "jam",
      priceText: "$10",
      memberPrice: "$5",
      venue: { _ref: "venue-1" },
      body: [{ _type: "block", children: [{ _type: "span", text: `${SECRET}: event` }] }],
    },
  ];
}

const VISIBILITIES: Record<string, object | undefined> = {
  everyone: { audience: "everyone" },
  members: { audience: "members" },
  bandUp: { audience: "levels", levels: ["band", "business", "sponsor"] },
  sponsorOnly: { audience: "levels", levels: ["sponsor"] },
  noLevels: { audience: "levels" },
  emptyLevels: { audience: "levels", levels: [] },
  unknown: { audience: "public" },
  missing: undefined,
};

const DATASET: Doc[] = [
  ...Object.entries(VISIBILITIES).flatMap(([name, visibility]) => docsFor(name, visibility)),
  { _id: "venue-1", _type: "venue", name: "The Blue Door", address: "1 Main St" },
];

const CONTENT: Record<GatedType, string> = {
  post: "{ excerpt, body }",
  page: "{ blocks }",
  event: '{ body, "venue": venue->{ name, address } }',
};

type Item = Record<string, unknown> & { locked: unknown; content: unknown };

async function run(
  query: string,
  params: Record<string, unknown>,
  dataset: Doc[] = DATASET,
): Promise<unknown> {
  const result = await evaluate(parse(query), { dataset, params });
  return result.get();
}

async function item(type: GatedType, name: string, memberLevel: string | null): Promise<Item> {
  return (await run(itemQuery(type, CONTENT[type]), {
    slug: `${type}-${name}`,
    memberLevel,
  })) as Item;
}

const MEMBER_LEVELS: (MembershipLevel | null)[] = [
  null,
  ...MEMBERSHIP_LEVELS.map((level) => level.value),
];

/** A viewer whose active level is `level` (a visitor for null). */
function viewerWith(level: MembershipLevel | null): Viewer {
  return level === null
    ? VISITOR
    : { kind: "member", userId: "u", level, expiresAt: "2099-01-01T00:00:00Z" };
}

describe("gated item queries", () => {
  it("give everyone the members-only fields of an item for everyone", async () => {
    for (const level of MEMBER_LEVELS) {
      const post = await item("post", "everyone", level);
      expect(post.locked).toBe(false);
      expect(post.content).toEqual({
        excerpt: `${SECRET}: excerpt`,
        body: expect.any(Array),
      });
    }
  });

  it("leave them out for viewers who can't see the item, and say it's locked", async () => {
    const post = await item("post", "members", null);
    expect(post).toEqual({
      _id: "post-members",
      _type: "post",
      _updatedAt: "2026-11-20T10:00:00Z",
      slug: "post-members",
      visibility: { audience: "members", levels: null },
      title: "Post members",
      category: "society-news",
      publishedAt: "2026-11-01T18:00:00Z",
      coverImage: { asset: { _ref: "image-1" }, alt: "Cover" },
      locked: true,
      content: null,
    });
  });

  it("agree with checkAccess for every visibility, type and level", async () => {
    for (const type of GATED_TYPES) {
      for (const [name, visibility] of Object.entries(VISIBILITIES)) {
        for (const level of MEMBER_LEVELS) {
          const result = await item(type, name, level);
          const { allowed } = checkAccess(
            visibility as never,
            viewerWith(level),
            new Date("2026-11-26T12:00:00Z"),
          );
          const label = `${type} ${name} as ${level ?? "visitor"}`;
          expect(result.locked, label).toBe(!allowed);
          expect(result.content === null, label).toBe(!allowed);
          // Nothing members-only outside `content`, whoever is looking.
          const { content, ...rest } = result;
          expect(JSON.stringify(rest), label).not.toContain(SECRET);
          if (allowed) expect(JSON.stringify(content), label).toContain(SECRET);
        }
      }
    }
  });

  it("open items for some levels only to those levels", async () => {
    expect((await item("event", "bandUp", "individual")).content).toBeNull();
    expect((await item("event", "bandUp", "band")).content).toEqual({
      body: expect.any(Array),
      venue: { name: "The Blue Door", address: "1 Main St" },
    });
    expect((await item("page", "sponsorOnly", "business")).content).toBeNull();
    expect((await item("page", "sponsorOnly", "sponsor")).content).toEqual({
      blocks: [{ _type: "textBlock", text: `${SECRET}: block` }],
    });
  });

  it("fail closed for a missing, unknown or empty audience", async () => {
    for (const name of ["noLevels", "emptyLevels", "unknown", "missing"]) {
      for (const level of MEMBER_LEVELS) {
        const post = await item("post", name, level);
        expect(post.locked, `${name} as ${level}`).toBe(true);
        expect(post.content, `${name} as ${level}`).toBeNull();
      }
    }
  });

  it("find nothing for an unknown web address", async () => {
    expect(await run(itemQuery("post", CONTENT.post), { slug: "nope", memberLevel: null })).toBe(
      null,
    );
  });
});

describe("gated list queries", () => {
  it("list every item of the type, locked ones without their members-only fields", async () => {
    const posts = (await run(listQuery("post", CONTENT.post, { order: "title asc" }), {
      memberLevel: "individual",
    })) as Item[];
    expect(posts.map((post) => [post.title, post.locked])).toEqual([
      ["Post bandUp", true],
      ["Post emptyLevels", true],
      ["Post everyone", false],
      ["Post members", false],
      ["Post missing", true],
      ["Post noLevels", true],
      ["Post sponsorOnly", true],
      ["Post unknown", true],
    ]);
    for (const post of posts) {
      expect(post.content === null).toBe(post.locked);
    }
  });

  it("apply the filter and the limit", async () => {
    const events = (await run(
      listQuery("event", CONTENT.event, {
        filter: "title in $titles",
        order: "title desc",
        limit: 2,
      }),
      { memberLevel: null, titles: ["Event members", "Event everyone", "Event bandUp"] },
    )) as Item[];
    expect(events.map((event) => [event.title, event.locked])).toEqual([
      ["Event members", true],
      ["Event everyone", false],
    ]);
  });

  it("refuse a filter or ordering that isn't one balanced expression", () => {
    for (const filter of ["x) || true || (y", "title == 'a", "a // b"]) {
      expect(() => listQuery("post", CONTENT.post, { filter }), filter).toThrow(
        "The list filter must be one balanced GROQ expression",
      );
    }
    expect(() => listQuery("post", CONTENT.post, { order: "title) | order(body" })).toThrow(
      "The list order must be one balanced GROQ expression",
    );
    // A blank filter or ordering is no filter or ordering.
    expect(listQuery("post", CONTENT.post, { filter: " ", order: "" })).toBe(
      listQuery("post", CONTENT.post),
    );
  });

  it("refuse a limit that isn't a whole number above 0", () => {
    for (const limit of [0, -1, 1.5, Number.NaN]) {
      expect(() => listQuery("post", CONTENT.post, { limit })).toThrow("whole number above 0");
    }
  });
});

describe("gatedProjection", () => {
  it("needs the members-only fields as one projection in braces", () => {
    expect(() => gatedProjection("post", "body")).toThrow("one GROQ projection in braces");
    expect(() => gatedProjection("post", "")).toThrow("one GROQ projection in braces");
    expect(gatedProjection("post", "  { body }  ")).toContain(`select(${CAN_VIEW} => @{ body })`);
  });

  it("keeps every members-only field inside content", async () => {
    // Closing the projection and select() early would make "leak" a public field of every item.
    const escape = '{ excerpt }), "leak": body, "more": ({ title }';
    expect(() => gatedProjection("post", escape)).toThrow("one GROQ projection in braces");
    // What that projection would have done, unchecked: proof the check matters.
    const unchecked = `*[_id == "post-members"][0]{ title, "content": select(${CAN_VIEW} => @${escape}) }`;
    const result = (await run(unchecked, { memberLevel: null })) as Record<string, unknown>;
    expect(result.leak).toEqual(expect.any(Array));
  });

  it("only builds queries for pages, posts and events", () => {
    expect(() => gatedProjection("venue" as GatedType, "{ name }")).toThrow(
      "Not a gated document type: venue",
    );
    expect(() => itemQuery("directoryEntry" as GatedType, "{ notes }")).toThrow(
      "Not a gated document type",
    );
  });
});

describe("isBalancedGroq", () => {
  it("accepts one balanced projection", () => {
    for (const text of [
      "{ body }",
      '{ excerpt, body, "author": author->{ name } }',
      '{ "url": "https://example.org/a}b" }',
      "{ 'paren': ')' }",
      '{ "quote": "say \\"hi\\" }" }',
    ]) {
      expect(isBalancedGroq(text, true), text).toBe(true);
    }
  });

  it("refuses text that could move fields out of their place", () => {
    for (const text of [
      '{ body }, "leak": body, "more": { title }',
      '{ "a": body) , "b": (body }',
      "{ body // }\n}",
      '{ "open": "unterminated }',
      "{ body ]",
      "{ body }}",
      "{ body",
      "body",
    ]) {
      expect(isBalancedGroq(text, true), text).toBe(false);
    }
  });

  it("checks a filter or ordering the same way, without the braces", () => {
    expect(isBalancedGroq("category == $category && (start > now())")).toBe(true);
    expect(isBalancedGroq("publishedAt desc, title asc")).toBe(true);
    expect(isBalancedGroq("x) || true || (y")).toBe(false);
    expect(isBalancedGroq("(a")).toBe(false);
  });
});

describe("reads of other documents", () => {
  // A public page and post that point at members-only ones: the shapes that C-2's blocks that fill
  // themselves and rich-text links invite. An item's gate doesn't cover what its GROQ reads
  // elsewhere.
  const NESTED: Doc[] = [
    {
      _id: "page-home",
      _type: "page",
      slug: { current: "home" },
      title: "Home",
      template: "standard",
      visibility: { audience: "everyone" },
      blocks: [{ _type: "upcomingEventsBlock", _key: "b1", heading: "Coming up", count: 3 }],
    },
    {
      _id: "post-public",
      _type: "post",
      slug: { current: "public" },
      title: "Public post",
      visibility: { audience: "everyone" },
      body: [
        {
          _type: "block",
          children: [{ _type: "span", text: "See the notes", marks: ["m1"] }],
          markDefs: [{ _key: "m1", _type: "link", internal: { _ref: "post-members" } }],
        },
      ],
    },
    ...docsFor("members", VISIBILITIES.members),
  ];
  const UPCOMING_EVENTS =
    '{ blocks[]{ ..., _type == "upcomingEventsBlock" => { "events": *[_type == "event"] | order(start asc)[0...3]{ title, start, body } } } }';

  it("refuses * in content, which would read other documents past their gates", async () => {
    for (const content of [UPCOMING_EVENTS, '{ "n": count(*[_type == "post"][0...3]) }']) {
      expect(() => gatedProjection("page", content), content).toThrow(
        "The members-only fields can't use * outside quotes",
      );
    }
    expect(() => itemQuery("page", UPCOMING_EVENTS)).toThrow(
      "own getGatedItem or listGatedItems call",
    );
    // What the upcoming-events projection would have done, unchecked: a visitor on the public home
    // page gets the members-only event's description.
    const unchecked = `*[_id == "page-home"][0]{ title, "content": select(${CAN_VIEW} => @${UPCOMING_EVENTS}) }`;
    const home = (await run(unchecked, { memberLevel: null }, NESTED)) as {
      content: { blocks: { events: unknown }[] };
    };
    expect(home.content.blocks[0].events).toEqual([
      {
        title: "Event members",
        start: "2026-12-05T01:00:00Z",
        body: [{ _type: "block", children: [{ _type: "span", text: `${SECRET}: event` }] }],
      },
    ]);
  });

  it("refuses * in a list filter or ordering", () => {
    // Whether any members-only post mentions a word: an answer without returning the post.
    const filter =
      'count(*[_type == "post" && visibility.audience != "everyone" && pt::text(body) match "jam"]) > 0';
    expect(() => listQuery("post", CONTENT.post, { filter })).toThrow(
      "The list filter can't use * outside quotes",
    );
    expect(() =>
      listQuery("post", CONTENT.post, { order: "count(*[references(^._id)]) desc" }),
    ).toThrow("The list order can't use * outside quotes");
  });

  it("allows * inside quotes", async () => {
    for (const filter of ['title match "post*"', "title match 'post*'", 'title != "a \\" * b"']) {
      expect(() => listQuery("post", CONTENT.post, { filter }), filter).not.toThrow();
    }
    expect(() => gatedProjection("post", '{ body, "note": "5 * 2" }')).not.toThrow();
    const posts = (await run(listQuery("post", CONTENT.post, { filter: 'title match "post*"' }), {
      memberLevel: null,
    })) as Item[];
    expect(posts).toHaveLength(Object.keys(VISIBILITIES).length);
  });

  it("needs a projection after each -> in content, listing what it reads", async () => {
    const bare = '{ body[]{ ..., markDefs[]{ ..., "target": internal-> } } }';
    for (const content of [
      bare,
      '{ "linked": body[0].markDefs[0].internal->excerpt }',
      '{ body[]{ ..., markDefs[]{ ..., "target": internal->{ ... } } } }',
    ]) {
      expect(() => gatedProjection("post", content), content).toThrow(
        "must follow each -> with a projection that lists the fields it reads",
      );
    }
    // Unchecked, a whole-document dereference gives a visitor the linked members-only post.
    const unchecked = `*[_id == "post-public"][0]{ "content": select(${CAN_VIEW} => @${bare}) }`;
    expect(JSON.stringify(await run(unchecked, { memberLevel: null }, NESTED))).toContain(
      `${SECRET}: body`,
    );
    // LINK_TARGET takes only what every locked item shows. (Venues can be dereferenced freely:
    // see CONTENT.event.)
    const links = `{ body[]{ ..., markDefs[]{ ..., "target": internal->${LINK_TARGET} } } }`;
    const post = (await run(
      itemQuery("post", links),
      { slug: "public", memberLevel: null },
      NESTED,
    )) as { content: { body: { markDefs: { target: unknown }[] }[] } };
    expect(post.content.body[0].markDefs[0].target).toEqual({
      _type: "post",
      slug: "post-members",
      title: "Post members",
    });
    expect(JSON.stringify(post)).not.toContain(SECRET);
  });
});

describe("readsOtherDocuments", () => {
  it("finds * outside quotes, in content, filters and orderings", () => {
    for (const [text, content] of [
      ['{ "n": count(*[_type == "post"][0...3]) }', true],
      ['{ "events": *[_type == "event"]{ title } }', true],
      ['{ "double": price * 2 }', true],
      ['{ "after": "quote"*2 }', true],
      ["count(*[references(^._id)]) desc", false],
      ['_id in *[_type == "post"]._id', false],
    ] as const) {
      expect(readsOtherDocuments(text, content), text).toBe("*");
    }
    for (const [text, content] of [
      ['{ "pattern": "jam*", "other": \'*\' }', true],
      ['{ "quote": "say \\"*\\"" }', true],
      ['title match "jam*"', false],
    ] as const) {
      expect(readsOtherDocuments(text, content), text).toBeNull();
    }
  });

  it("finds a dereference in content that doesn't list the fields it reads", () => {
    for (const text of [
      '{ "target": internal-> }',
      '{ "body": internal->body }',
      '{ "target": internal->{ ... } }',
      '{ "target": internal->{ _type, ..., title } }',
      '{ "target": internal->{ _type == "post" => { ... } } }',
      '{ "venue": venue->{ "all": { ... } } }',
    ]) {
      expect(readsOtherDocuments(text, true), text).toBe("->");
    }
    for (const text of [
      '{ "venue": venue->{ name, address, mapUrl } }',
      '{ "venue": venue -> { name } }',
      '{ "sponsors": sponsors[]->{ name, "tags": tags[0...3] } }',
      `{ body[]{ ..., markDefs[]{ ..., "target": internal->${LINK_TARGET} } } }`,
      '{ "arrow": "->", body }',
    ]) {
      expect(readsOtherDocuments(text, true), text).toBeNull();
    }
    // Not checked in filters and orderings, where `venue->name` is the natural way to write it:
    // they use public fields only, as the docs say.
    expect(readsOtherDocuments("venue->name asc", false)).toBeNull();
  });
});

describe("PUBLIC_FIELDS", () => {
  it("never makes members-only parts public (docs/design/prototype.html)", () => {
    // A locked post shows no summary or post, a locked event no venue or description, and a
    // locked page none of its blocks.
    const membersOnly = ["excerpt", "body", "venue", "blocks", "author"];
    for (const type of GATED_TYPES) {
      for (const field of membersOnly) {
        expect(PUBLIC_FIELDS[type], `${type}.${field}`).not.toContain(field);
      }
    }
  });
});
