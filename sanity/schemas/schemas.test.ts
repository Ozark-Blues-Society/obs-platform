// @vitest-environment node
// Runs Sanity's own schema compiler and document validation (what the Studio runs) against the
// content model, with a stand-in client, so no Sanity project is needed.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSchema, validateDocument, type SanityDocument, type Workspace } from "sanity";
import { beforeAll, describe, expect, it } from "vitest";
import {
  EVENT_CATEGORIES as FIXTURE_EVENT_CATEGORIES,
  EVENT_TIME_ZONE,
} from "@/scripts/fixtures/events.mts";
import { LEVELS as FIXTURE_LEVELS } from "@/scripts/fixtures/members.mts";
import { createTestWorkspace, stubClient, type Fetch } from "@/sanity/test-workspace";
import { documentTypes, schemaTypes } from ".";
import { BOARD_BENEFITS } from "./documents/site-settings";
import {
  EVENT_CATEGORIES,
  MEMBERSHIP_LEVELS,
  RESERVED_PAGE_SLUGS,
  SOCIETY_TIME_ZONE,
} from "./options";
import { OTHER_FEATURED_SPONSORS_QUERY } from "./validation";

/** The content model on its own, compiled as the Studio compiles it. */
const schema = createSchema({ name: "obs-test", types: schemaTypes });

/** Slug checks find no other document with the same web address unless a test says otherwise. */
const defaultFetch: Fetch = (query) => {
  if (query.includes("slug.current == $slug")) return true;
  if (query === OTHER_FEATURED_SPONSORS_QUERY) return [];
  throw new Error(`Unexpected query in test: ${query}`);
};

/** The Studio's workspace, from sanity.config.ts. */
let workspace: Workspace;
beforeAll(async () => {
  workspace = await createTestWorkspace(defaultFetch);
});

/** The validation errors the Studio would show for a draft, as "path: message". */
async function errors(document: Record<string, unknown>, fetch: Fetch = defaultFetch) {
  const markers = await validateDocument({
    document: {
      _id: "drafts.test-doc",
      _createdAt: "2026-11-26T00:00:00Z",
      _updatedAt: "2026-11-26T00:00:00Z",
      _rev: "test",
      ...document,
    } as SanityDocument,
    workspace,
    getClient: () => stubClient(fetch) as never,
    getDocumentExists: async () => true,
    validateReferenceTypes: false,
  });
  return markers
    .filter((marker) => marker.level === "error")
    .map(
      (marker) =>
        `${marker.path.map((s) => (typeof s === "object" && "_key" in s ? s._key : String(s))).join(".")}: ${marker.message}`,
    );
}

const ref = (id: string) => ({ _type: "reference", _ref: id });
const slug = (current: string) => ({ _type: "slug", current });
const image = (alt?: string) => ({
  _type: "image",
  asset: ref("image-abc123-1600x900-jpg"),
  ...(alt === undefined ? {} : { alt }),
});
const paragraph = (text: string) => [
  {
    _type: "block",
    _key: "p1",
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: "s1", text, marks: [] }],
  },
];
const everyone = { _type: "visibility", audience: "everyone" };

/** One complete, valid document of each type, shaped like the fixtures and the concept. */
const VALID: Record<string, Record<string, unknown>> = {
  page: {
    _type: "page",
    title: "Venue & Booking Directory",
    slug: slug("venue-and-booking-directory"),
    template: "directory",
    visibility: { _type: "visibility", audience: "members" },
    menuPlacement: "member-resources",
    blocks: [
      { _type: "textBlock", _key: "b1", body: paragraph("Venues that book blues in the region.") },
      { _type: "tableBlock", _key: "b2", heading: "Venue directory", source: "directory" },
      { _type: "formBlock", _key: "b3", form: "volunteer" },
    ],
  },
  event: {
    _type: "event",
    title: "Delta Night: The Mavis Crane Band",
    slug: slug("delta-night-the-mavis-crane-band"),
    start: "2026-12-06T02:00:00Z",
    recurrence: { frequency: "none" },
    venue: ref("fixture-venue-old-mill"),
    category: "concert",
    priceText: "$15",
    memberPrice: "$10",
    visibility: everyone,
    image: image("Band performing on stage under warm lights"),
    body: paragraph("Hill-country grooves and slide guitar. Doors at 7."),
  },
  post: {
    _type: "post",
    title: "Fall Fest Recap: 1,200 Fans and a Whole Lot of Slide Guitar",
    slug: slug("fall-fest-recap"),
    coverImage: image("Crowd in front of the stage at Fall Fest"),
    category: "recap",
    author: ref("person-communications"),
    excerpt: "Two days, eleven bands, and one very muddy field.",
    body: paragraph("Here are the highlights and photo gallery."),
    visibility: everyone,
    includeInDigest: true,
    publishedAt: "2026-10-14T15:00:00Z",
  },
  sponsor: {
    _type: "sponsor",
    name: "Riverbend Brewing Co.",
    website: "https://example.com",
    logo: image("Riverbend Brewing Co. logo"),
    tier: ref("sponsor-tier-sponsor"),
    featured: true,
    blurb: "Riverbend has hosted our Tuesday Open Jam for six years.",
    endsAt: "2027-12-31",
  },
  sponsorTier: {
    _type: "sponsorTier",
    name: "Sponsor",
    pricePerYear: 500,
    benefits: ["Everything Business members get", "Sponsor Spotlight highlight"],
    logoPlacement: "large",
    sortOrder: 1,
  },
  venue: {
    _type: "venue",
    name: "Old Mill Music Hall",
    address: "410 Mill Street, Riverbend",
    mapUrl: "https://example.com/map/old-mill-music-hall",
  },
  directoryEntry: {
    _type: "directoryEntry",
    venue: ref("fixture-venue-old-mill"),
    capacity: "350",
    pay: "Door split or guarantee",
    notes: "Sound tech provided.",
    bookingContact: { name: "Sam Ortega", email: "booking.oldmill@example.com" },
  },
  person: {
    _type: "person",
    name: "Dee Harmon",
    role: "Volunteer of the Year",
    boardMember: true,
    boardOrder: 3,
  },
  siteSettings: {
    _id: "drafts.siteSettings",
    _type: "siteSettings",
    footerText: "A community nonprofit.",
    email: "info@example.org",
    socialLinks: [
      { _type: "socialLink", _key: "fb", platform: "facebook", url: "https://example.com/obs" },
    ],
    membershipBenefits: BOARD_BENEFITS,
    menuLinks: [
      {
        _type: "menuLink",
        _key: "m1",
        label: "Festival",
        href: "https://example.org",
        placement: "events",
      },
    ],
  },
};

/** Every top-level route segment under app/, looking inside route groups like (site). */
function appRouteSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[_[@]/.test(entry.name))
    .flatMap((entry) =>
      /^\(.+\)$/.test(entry.name) ? appRouteSegments(join(dir, entry.name)) : [entry.name],
    );
}

/** Fields without a description, as dotted paths, walking objects, arrays and link annotations. */
type Definition = {
  name?: string;
  type?: string;
  description?: unknown;
  fields?: Definition[];
  of?: Definition[];
  marks?: { annotations?: Definition[] };
};
function undescribedFields(definition: Definition, path: string): string[] {
  return [
    ...(definition.fields ?? []).flatMap((field) => {
      const here = `${path}.${field.name}`;
      const described =
        typeof field.description === "string" && field.description.trim().length >= 10;
      return [...(described ? [] : [here]), ...undescribedFields(field, here)];
    }),
    ...(definition.of ?? []).flatMap((member) =>
      undescribedFields(member, `${path}[${member.name ?? member.type}]`),
    ),
    ...(definition.marks?.annotations ?? []).flatMap((annotation) =>
      undescribedFields(annotation, `${path}{${annotation.name}}`),
    ),
  ];
}

describe("the content model", () => {
  it("compiles with no schema errors or warnings", () => {
    const groups = (
      schema as unknown as {
        _validation?: {
          path: { name?: string; type?: string }[];
          problems: { severity: string; message: string }[];
        }[];
      }
    )._validation;
    const problems = (groups ?? []).flatMap((group) =>
      group.problems.map(
        (problem) =>
          `${problem.severity}: ${group.path.map((p) => p.name ?? p.type).join(" > ")}: ${problem.message}`,
      ),
    );
    expect(problems).toEqual([]);
  });

  it("has the document types the architecture and the backlog list", () => {
    expect(documentTypes.map((type) => type.name).sort()).toEqual(
      [
        "directoryEntry",
        "event",
        "page",
        "person",
        "post",
        "siteSettings",
        "sponsor",
        "sponsorTier",
        "venue",
      ].sort(),
    );
  });

  it("describes every field in plain language for volunteers", () => {
    const missing = schemaTypes.flatMap((type) => undescribedFields(type as Definition, type.name));
    expect(missing).toEqual([]);
  });

  it("keeps booking contacts off the public venue type, in their own labelled fields", () => {
    type Compiled = {
      fields: { name: string; type: { description?: string; fields?: Compiled["fields"] } }[];
    };
    const venue = schema.get("venue") as Compiled;
    expect(venue.fields.map((field) => field.name)).toEqual(["name", "address", "mapUrl"]);
    const entry = schema.get("directoryEntry") as Compiled;
    const booking = entry.fields.find((field) => field.name === "bookingContact");
    expect(booking?.type.fields?.map((field) => field.name)).toEqual(["name", "email", "phone"]);
    const descriptions = [
      booking?.type.description,
      ...(booking?.type.fields ?? []).map((f) => f.type.description),
    ];
    for (const text of descriptions) {
      expect(text).toContain("Only Band, Business and Sponsor members see");
    }
  });

  it("uses the levels, categories and time zone the fixtures use", () => {
    expect(MEMBERSHIP_LEVELS.map((level) => level.value)).toEqual([...FIXTURE_LEVELS]);
    expect(EVENT_CATEGORIES.map((category) => category.value)).toEqual(
      FIXTURE_EVENT_CATEGORIES.map((category) => category.toLowerCase()),
    );
    expect(SOCIETY_TIME_ZONE).toBe(EVENT_TIME_ZONE);
  });

  it("reserves every top-level route in app/, so no page can hide behind one", () => {
    const appDir = fileURLToPath(new URL("../../app/", import.meta.url));
    const segments = appRouteSegments(appDir);
    expect(segments.length).toBeGreaterThan(0);
    expect(
      segments.filter((segment) => !(RESERVED_PAGE_SLUGS as readonly string[]).includes(segment)),
    ).toEqual([]);
  });
});

describe("Studio validation", () => {
  it.each(Object.keys(VALID))("accepts a complete %s", async (type) => {
    expect(await errors(VALID[type])).toEqual([]);
  });

  it.each([
    ["page", ["title", "slug", "template", "visibility", "menuPlacement", "blocks"]],
    ["event", ["title", "slug", "start", "recurrence", "category", "visibility"]],
    ["post", ["title", "slug", "category", "excerpt", "body", "visibility", "publishedAt"]],
    ["sponsor", ["name", "tier"]],
    ["sponsorTier", ["name", "logoPlacement"]],
    ["venue", ["name", "address"]],
    ["directoryEntry", ["venue"]],
    ["person", ["name"]],
  ])("requires the %s fields editors must fill in", async (type, required) => {
    const found = await errors({ _type: type });
    // A missing object also fails its own required parts (slug.current, visibility.audience).
    expect(found.every((error) => error.endsWith(": Required"))).toBe(true);
    const fields = new Set(found.map((error) => error.split(/[.:]/)[0]));
    expect([...fields].sort()).toEqual([...required].sort());
  });

  it("rejects a web address another document of the same type uses", async () => {
    const taken: Fetch = (query, params) => {
      if (query.includes("slug.current == $slug")) {
        expect(params).toMatchObject({ docType: "post", slug: "fall-fest-recap" });
        return false;
      }
      return defaultFetch(query, params);
    };
    expect(await errors(VALID.post, taken)).toEqual(["slug: Slug is already in use"]);
  });

  it("rejects a page web address that an app route uses, and one with spaces or capitals", async () => {
    expect(await errors({ ...VALID.page, slug: slug("events") })).toEqual([
      "slug: The website already uses /events for something else. Choose a different web address.",
    ]);
    expect(await errors({ ...VALID.post, slug: slug("Fall Fest") })).toEqual([
      expect.stringMatching(/^slug: Use only lowercase letters, numbers and hyphens/),
    ]);
  });

  it("checks a repeating event's last date against its first date", async () => {
    const weekly = (until?: string) => ({
      ...VALID.event,
      start: "2026-12-04T01:00:00Z", // December 3, 7 p.m. Central
      recurrence: { frequency: "weekly", ...(until ? { until } : {}) },
    });
    expect(await errors(weekly())).toEqual([
      "recurrence.until: Choose the last date it repeats on.",
    ]);
    expect(await errors(weekly("2026-12-03"))).toEqual([
      "recurrence.until: The last date must be after the first date (December 3, 2026).",
    ]);
    expect(await errors(weekly("2026-12-04"))).toEqual([]);
  });

  it("allows only one featured sponsor at a time", async () => {
    let asked: Record<string, unknown> = {};
    const anotherFeatured: Fetch = (query, params) => {
      if (query === OTHER_FEATURED_SPONSORS_QUERY) {
        asked = params;
        return ["Old Mill Music Hall"];
      }
      return defaultFetch(query, params);
    };
    expect(await errors(VALID.sponsor, anotherFeatured)).toEqual([
      "featured: Only one sponsor can be featured at a time, and Old Mill Music Hall is featured now. Turn off Featured there and publish that sponsor first.",
    ]);
    expect(asked).toMatchObject({ publishedId: "test-doc" });
    // An unfeatured sponsor never conflicts.
    expect(await errors({ ...VALID.sponsor, featured: false }, anotherFeatured)).toEqual([]);
  });

  it("needs spotlight text for a featured sponsor", async () => {
    expect(await errors({ ...VALID.sponsor, blurb: undefined })).toEqual([
      "blurb: Write the spotlight text: it shows while this sponsor is featured.",
    ]);
  });

  it("needs at least one level when only some levels can see an item", async () => {
    const limited = (levels?: string[]) => ({
      ...VALID.post,
      visibility: { _type: "visibility", audience: "levels", ...(levels ? { levels } : {}) },
    });
    expect(await errors(limited())).toEqual([
      "visibility.levels: Tick at least one membership level, or choose who can see this above.",
    ]);
    expect(await errors(limited(["band", "business", "sponsor"]))).toEqual([]);
  });

  it("needs alt text on every uploaded image, including photos inside text", async () => {
    expect(await errors({ ...VALID.event, image: image() })).toEqual([
      "image.alt: Describe the image for people who can't see it.",
    ]);
    const body = [
      ...paragraph("Photos below."),
      { _type: "image", _key: "photo1", asset: ref("image-def-800x600-jpg") },
    ];
    expect(await errors({ ...VALID.post, body })).toEqual([
      "body.photo1.alt: Describe the image for people who can't see it.",
    ]);
  });

  it("checks page blocks: video links, table rows and button links", async () => {
    const withBlocks = (blocks: Record<string, unknown>[]) => ({ ...VALID.page, blocks });
    expect(
      await errors(
        withBlocks([
          { _type: "videoBlock", _key: "v", url: "https://example.org/clip.mp4", title: "Clip" },
        ]),
      ),
    ).toEqual([
      expect.stringMatching(/^blocks\.v\.url: Paste the link to a YouTube or Vimeo video/),
    ]);
    expect(
      await errors(
        withBlocks([
          {
            _type: "tableBlock",
            _key: "t",
            heading: "Prices",
            source: "custom",
            columns: ["Level", "Price"],
            rows: [{ _type: "tableRow", _key: "r1", cells: ["Band"] }],
          },
        ]),
      ),
    ).toEqual([
      "blocks.t.rows: Row 1 has 1 cell, but the table has 2 columns. Give every row one cell per column.",
    ]);
    expect(
      await errors(
        withBlocks([
          {
            _type: "buttonBlock",
            _key: "b",
            label: "Join now",
            link: { _type: "link", href: "javascript:alert(1)" },
          },
        ]),
      ),
    ).toEqual([expect.stringMatching(/^blocks\.b\.link\.href: Use a web address/)]);
  });

  it("starts Site settings with the board's benefits table", async () => {
    expect(BOARD_BENEFITS).toHaveLength(11);
    expect(BOARD_BENEFITS.find((row) => row._key === "sponsor-discount")).toMatchObject({
      benefit: "10% off paid Society events and other paid items",
      levels: ["sponsor"],
    });
    expect(BOARD_BENEFITS.find((row) => row._key === "booking-contacts")?.levels).toEqual([
      "band",
      "business",
      "sponsor",
    ]);
    expect(
      await errors({
        _id: "drafts.siteSettings",
        _type: "siteSettings",
        membershipBenefits: BOARD_BENEFITS,
      }),
    ).toEqual([]);
  });
});
