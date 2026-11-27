// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { stegaClean } from "next-sanity";
import { describe, expect, it } from "vitest";
import { itemQuery } from "@/sanity/content/gated-query";
import {
  PAGE_CONTENT,
  blockPhoto,
  linkHref,
  pageTemplate,
  parsePageBlocks,
  type PageBlock,
} from "./blocks";

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

const PHOTO = {
  _type: "image",
  asset: { _type: "reference", _ref: "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x1125-jpg" },
  hotspot: { _type: "sanity.imageHotspot", x: 0.4, y: 0.3, width: 0.5, height: 0.5 },
  crop: { _type: "sanity.imageCrop", top: 0, bottom: 0.1, left: 0, right: 0 },
  alt: "The trio on stage",
};

const toPage = { target: { _type: "page", slug: "about-and-volunteer", title: "About" } };

/** The kind and key of each block, which is enough to see what was kept. */
const kinds = (blocks: PageBlock[]) => blocks.map((block) => `${block.kind}:${block.key}`);

describe("parsePageBlocks", () => {
  it("turns each kind of block into the values its component takes", () => {
    const body = [{ _type: "block", _key: "p1", children: [{ _type: "span", text: "Hello" }] }];
    const blocks = parsePageBlocks([
      {
        _type: "heroBlock",
        _key: "h",
        heading: "The Muddy Ridge Trio",
        text: "Hill-country blues.",
        image: PHOTO,
        button: { _type: "buttonBlock", label: "See shows", link: toPage },
      },
      { _type: "textBlock", _key: "t", body },
      { _type: "imageBlock", _key: "i", image: PHOTO, caption: "Fall Fest" },
      {
        _type: "videoBlock",
        _key: "v",
        url: "https://youtu.be/dQw4w9WgXcQ",
        title: "Live at Old Mill",
        caption: "Recorded in 2026",
      },
      { _type: "upcomingEventsBlock", _key: "e", heading: "Upcoming shows", count: 4 },
      {
        _type: "sponsorStripBlock",
        _key: "s",
        heading: "Our sponsors",
        sponsors: [{ _type: "reference", _ref: "sponsor-a", _key: "x" }],
      },
      {
        _type: "tableBlock",
        _key: "tb",
        heading: "Venues",
        source: "custom",
        columns: ["Venue", "Capacity"],
        rows: [{ _key: "r", cells: ["Old Mill", "350"] }],
      },
      { _type: "tableBlock", _key: "d", heading: "Venue directory", source: "directory" },
      { _type: "buttonBlock", _key: "b", label: "Join now", link: { href: "/join" } },
      { _type: "quoteBlock", _key: "q", quote: "Loud, and from the heart.", attribution: "Dale" },
      {
        _type: "formBlock",
        _key: "f",
        form: "volunteer",
        heading: "Sign up",
        intro: "We'll call.",
      },
    ]);

    expect(blocks).toEqual([
      {
        kind: "hero",
        key: "h",
        heading: "The Muddy Ridge Trio",
        text: "Hill-country blues.",
        photo: {
          image: {
            asset: { _ref: PHOTO.asset._ref },
            crop: { top: 0, bottom: 0.1, left: 0, right: 0 },
            hotspot: { x: 0.4, y: 0.3, width: 0.5, height: 0.5 },
          },
          alt: "The trio on stage",
        },
        button: { label: "See shows", href: "/about-and-volunteer" },
      },
      { kind: "text", key: "t", body },
      {
        kind: "image",
        key: "i",
        photo: expect.objectContaining({ alt: "The trio on stage" }),
        caption: "Fall Fest",
      },
      {
        kind: "video",
        key: "v",
        title: "Live at Old Mill",
        caption: "Recorded in 2026",
        embed: { provider: "youtube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
      },
      { kind: "upcomingEvents", key: "e", heading: "Upcoming shows", count: 4 },
      { kind: "sponsorStrip", key: "s", heading: "Our sponsors", sponsorIds: ["sponsor-a"] },
      {
        kind: "table",
        key: "tb",
        heading: "Venues",
        columns: ["Venue", "Capacity"],
        rows: [["Old Mill", "350"]],
      },
      { kind: "directory", key: "d", heading: "Venue directory" },
      { kind: "button", key: "b", label: "Join now", href: "/join" },
      { kind: "quote", key: "q", quote: "Loud, and from the heart.", attribution: "Dale" },
      { kind: "form", key: "f", form: "volunteer", heading: "Sign up", intro: "We'll call." },
    ]);
  });

  it("skips blocks of a type it doesn't know, and anything that isn't a block", () => {
    const blocks = parsePageBlocks([
      { _type: "carouselBlock", _key: "c", heading: "From a newer schema" },
      { _key: "n", heading: "No type" },
      "a string",
      null,
      ["an", "array"],
      { _type: "quoteBlock", _key: "q", quote: "Kept" },
    ]);
    expect(kinds(blocks)).toEqual(["quote:q"]);
    expect(parsePageBlocks(undefined)).toEqual([]);
    expect(parsePageBlocks({ _type: "quoteBlock", quote: "Not in a list" })).toEqual([]);
  });

  it("skips blocks that aren't complete yet, as in a draft", () => {
    const blocks = parsePageBlocks([
      { _type: "heroBlock", _key: "1", image: PHOTO },
      { _type: "heroBlock", _key: "2", heading: "   " },
      { _type: "textBlock", _key: "3", body: [] },
      { _type: "textBlock", _key: "4", body: ["not a block"] },
      { _type: "imageBlock", _key: "5", caption: "No photo yet" },
      { _type: "imageBlock", _key: "6", image: { asset: { _ref: "file-abc-pdf" } } },
      { _type: "videoBlock", _key: "7", url: "https://example.com/video", title: "Not embeddable" },
      { _type: "videoBlock", _key: "8", url: "https://youtu.be/dQw4w9WgXcQ" },
      { _type: "upcomingEventsBlock", _key: "9", count: 3 },
      { _type: "sponsorStripBlock", _key: "10" },
      { _type: "tableBlock", _key: "11", source: "custom", columns: ["A"], rows: [] },
      { _type: "tableBlock", _key: "12", heading: "No columns", rows: [{ cells: ["x"] }] },
      { _type: "tableBlock", _key: "13", heading: "Empty rows", columns: ["A"], rows: [{}] },
      { _type: "buttonBlock", _key: "14", label: "Nowhere" },
      { _type: "buttonBlock", _key: "15", link: { href: "/join" } },
      { _type: "buttonBlock", _key: "16", label: "Unsafe", link: { href: "javascript:alert(1)" } },
      { _type: "quoteBlock", _key: "17", attribution: "Nobody" },
      { _type: "formBlock", _key: "18", form: "survey" },
    ]);
    expect(blocks).toEqual([]);
  });

  it("keeps a hero whose photo or button isn't ready, without them", () => {
    const [hero] = parsePageBlocks([
      {
        _type: "heroBlock",
        _key: "h",
        heading: "Blues Challenge 2027",
        image: { _type: "image" },
        button: { label: "Apply", link: { target: null } },
      },
    ]);
    expect(hero).toEqual({
      kind: "hero",
      key: "h",
      heading: "Blues Challenge 2027",
      text: undefined,
      photo: undefined,
      button: undefined,
    });
  });

  it("gives every row of a typed table one cell per column", () => {
    const [table] = parsePageBlocks([
      {
        _type: "tableBlock",
        _key: "t",
        heading: "Venues",
        columns: ["Venue", "Capacity", "Notes"],
        rows: [
          { cells: ["Old Mill", "350"] },
          { cells: ["Riverside Tap", "120", "Fridays", "extra"] },
          { cells: ["", "  "] },
          { cells: [null, 80, "No name"] },
        ],
      },
    ]);
    expect(table).toMatchObject({
      rows: [
        ["Old Mill", "350", ""],
        ["Riverside Tap", "120", "Fridays"],
        ["", "", "No name"],
      ],
    });
  });

  it("shows 3 upcoming events unless the count is a whole number from 1 to 12", () => {
    const count = (value: unknown) =>
      (
        parsePageBlocks([{ _type: "upcomingEventsBlock", heading: "Shows", count: value }])[0] as {
          count: number;
        }
      ).count;
    expect(count(12)).toBe(12);
    expect(count(1)).toBe(1);
    for (const value of [0, 13, 2.5, "4", null, undefined]) expect(count(value)).toBe(3);
  });

  it("keys blocks by Sanity's _key, or by position if it's missing or repeated", () => {
    const quote = (key?: string) => ({ _type: "quoteBlock", _key: key, quote: "Q" });
    expect(kinds(parsePageBlocks([quote("a"), quote(), quote("a"), quote("b")]))).toEqual([
      "quote:a",
      "quote:block-1",
      "quote:block-2",
      "quote:b",
    ]);
  });

  it("in a preview, cleans the edit markers from what the site acts on and keeps them on text", () => {
    const heading = withEditMarker("Venues");
    const blocks = parsePageBlocks([
      {
        _type: withEditMarker("tableBlock"),
        _key: "d",
        heading,
        source: withEditMarker("directory"),
      },
      {
        _type: "videoBlock",
        _key: "v",
        url: withEditMarker("https://youtu.be/dQw4w9WgXcQ"),
        title: withEditMarker("Live"),
      },
      { _type: "buttonBlock", _key: "b", label: heading, link: { href: withEditMarker("/join") } },
      { _type: "formBlock", _key: "f", form: withEditMarker("volunteer") },
      {
        _type: "sponsorStripBlock",
        _key: "s",
        heading,
        sponsors: [{ _ref: withEditMarker("sp-1") }],
      },
      { _type: "heroBlock", _key: "h", heading, text: heading },
      { _type: "quoteBlock", _key: "q", quote: heading, attribution: heading },
    ]);
    expect(blocks).toEqual([
      { kind: "directory", key: "d", heading },
      {
        kind: "video",
        key: "v",
        title: "Live",
        caption: undefined,
        embed: { provider: "youtube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
      },
      { kind: "button", key: "b", label: heading, href: "/join" },
      { kind: "form", key: "f", form: "volunteer", heading: undefined, intro: undefined },
      { kind: "sponsorStrip", key: "s", heading, sponsorIds: ["sp-1"] },
      { kind: "hero", key: "h", heading, text: heading, photo: undefined, button: undefined },
      { kind: "quote", key: "q", quote: heading, attribution: heading },
    ]);
    expect(stegaClean(heading)).toBe("Venues");
  });
});

describe("linkHref", () => {
  it("links to the page, post or event a link points at", () => {
    expect(linkHref(toPage)).toBe("/about-and-volunteer");
    expect(linkHref({ target: { _type: "post", slug: "fall-fest-recap", title: "Recap" } })).toBe(
      "/blog/fall-fest-recap",
    );
    expect(linkHref({ target: { _type: "event", slug: withEditMarker("friday-jam") } })).toBe(
      "/events/friday-jam",
    );
  });

  it("falls back to the web address, if it's safe, when there's no target", () => {
    expect(linkHref({ href: "/join" })).toBe("/join");
    expect(linkHref({ href: " https://example.com/apply " })).toBe("https://example.com/apply");
    expect(linkHref({ href: "mailto:info@example.com" })).toBe("mailto:info@example.com");
    // A reference to a page that was deleted or isn't published comes back as a null target.
    expect(linkHref({ target: null, href: "/events" })).toBe("/events");
  });

  it("returns null for no destination, an unknown target or an unsafe address", () => {
    for (const link of [
      undefined,
      null,
      "/join",
      {},
      { target: null },
      { target: { _type: "venue", slug: "old-mill" } },
      { target: { _type: "constructor", slug: "x" } },
      { target: { _type: "page", slug: "Not A Slug" } },
      { href: "javascript:alert(1)" },
      { href: "//evil.example/path" },
      { href: "https://localhost/" },
    ]) {
      expect(linkHref(link), JSON.stringify(link)).toBeNull();
    }
  });
});

describe("blockPhoto", () => {
  it("leaves out a crop or focal point with a value missing", () => {
    expect(
      blockPhoto({ asset: { _ref: PHOTO.asset._ref }, hotspot: { x: 0.5, y: 0.5 }, crop: {} }),
    ).toEqual({ image: { asset: { _ref: PHOTO.asset._ref } }, alt: "" });
  });

  it("cleans the edit markers from the asset and the alt text", () => {
    expect(
      blockPhoto({ asset: { _ref: withEditMarker(PHOTO.asset._ref) }, alt: withEditMarker("Alt") }),
    ).toEqual({ image: { asset: { _ref: PHOTO.asset._ref } }, alt: "Alt" });
  });
});

describe("pageTemplate", () => {
  it("reads the four templates, and treats anything else as Standard", () => {
    expect(pageTemplate("directory")).toBe("directory");
    expect(pageTemplate(withEditMarker("spotlight"))).toBe("spotlight");
    expect(pageTemplate("promo")).toBe("promo");
    expect(pageTemplate("gallery")).toBe("standard");
    expect(pageTemplate(undefined)).toBe("standard");
  });
});

describe("PAGE_CONTENT", () => {
  const MEMBERS_ONLY = "Members-only text";
  const dataset = [
    {
      _id: "page-about",
      _type: "page",
      slug: { current: "about" },
      title: "About",
      intro: "Who we are.",
      template: "standard",
      visibility: { audience: "members" },
      blocks: [
        {
          _type: "textBlock",
          _key: "t",
          body: [{ _type: "block", children: [{ text: MEMBERS_ONLY }] }],
        },
        {
          _type: "buttonBlock",
          _key: "b",
          label: "Read the minutes",
          link: { internal: { _type: "reference", _ref: "post-minutes" } },
        },
        {
          _type: "heroBlock",
          _key: "h",
          heading: "Hero",
          button: { label: "More", link: { internal: { _ref: "post-minutes" }, href: "" } },
        },
      ],
      memberFiles: [{ _key: "f", title: "Minutes", fileId: "file-1" }],
    },
    {
      _id: "post-minutes",
      _type: "post",
      slug: { current: "board-minutes" },
      title: "Board minutes",
      excerpt: `${MEMBERS_ONLY}: the post's summary`,
      body: [{ _type: "block", children: [{ text: `${MEMBERS_ONLY}: the post` }] }],
      visibility: { audience: "levels", levels: ["band"] },
    },
  ];

  async function run(memberLevel: string | null) {
    const query = itemQuery("page", PAGE_CONTENT);
    const value = await evaluate(parse(query), { dataset, params: { slug: "about", memberLevel } });
    return (await value.get()) as Record<string, unknown>;
  }

  it("gives a member the blocks and files, with only the public fields of what a button points at", async () => {
    const page = await run("individual");
    const content = page.content as { blocks: Record<string, unknown>[]; memberFiles: unknown };
    expect(content.memberFiles).toEqual([{ title: "Minutes", fileId: "file-1" }]);
    const target = { _type: "post", slug: "board-minutes", title: "Board minutes" };
    expect(content.blocks[1].link).toEqual({ href: null, target });
    expect((content.blocks[2].button as { link: unknown }).link).toEqual({ href: "", target });
    // The linked post's members-only fields never come along, whatever level asks.
    expect(JSON.stringify(page)).not.toContain(`${MEMBERS_ONLY}: the post`);
    expect(parsePageBlocks(content.blocks).map((block) => block.kind)).toEqual([
      "text",
      "button",
      "hero",
    ]);
  });

  it("gives a visitor the title, intro and template, and none of the blocks or files", async () => {
    const page = await run(null);
    expect(page).toMatchObject({ title: "About", intro: "Who we are.", template: "standard" });
    expect(page.content).toBeNull();
    expect(JSON.stringify(page)).not.toContain(MEMBERS_ONLY);
    expect(JSON.stringify(page)).not.toContain("Minutes");
  });
});
