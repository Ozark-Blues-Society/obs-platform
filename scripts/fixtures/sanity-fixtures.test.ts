// @vitest-environment node
import { validateDocument, type SanityDocument, type Workspace } from "sanity";
import { beforeAll, describe, expect, it } from "vitest";
import { BOARD_BENEFITS } from "@/sanity/schemas/board-benefits";
import { createTestWorkspace, stubClient, type Fetch } from "@/sanity/test-workspace";
import { EVENTS, VENUES } from "./events.mts";
import {
  directoryEntryId,
  fixtureDocuments,
  fixtureMutations,
  importSanityFixtures,
  slugFromTitle,
  type FixtureDocument,
} from "./sanity-fixtures.mts";

// Noon in Central Time on Friday, November 27, 2026.
const NOW = new Date("2026-11-27T18:00:00Z");
const { fixtures, siteSettings } = fixtureDocuments(NOW);
const ALL = [...fixtures, siteSettings];
const byId = (id: string) => ALL.find((document) => document._id === id)!;

/**
 * Answers the Studio's web address check from the fixtures themselves: a slug is taken when
 * another fixture document of the same type has it.
 */
const fixtureFetch: Fetch = (query, params) => {
  if (query.includes("slug.current == $slug")) {
    return !ALL.some(
      (other) =>
        other._type === params.docType &&
        other._id !== params.published &&
        (other.slug as { current?: string } | undefined)?.current === params.slug,
    );
  }
  throw new Error(`Unexpected query in test: ${query}`);
};

let workspace: Workspace;
beforeAll(async () => {
  workspace = await createTestWorkspace(fixtureFetch);
});

/** Every message the Studio would show for the document once written ("path: message"). */
async function studioMarkers(document: FixtureDocument) {
  const missing: string[] = [];
  const markers = await validateDocument({
    document: {
      ...document,
      _createdAt: "2026-11-27T18:00:00Z",
      _updatedAt: "2026-11-27T18:00:00Z",
      _rev: "fixture",
    } as SanityDocument,
    workspace,
    getClient: () => stubClient(fixtureFetch) as never,
    // A reference must point at a document the import writes.
    getDocumentExists: async ({ id }) => {
      const exists = ALL.some((other) => other._id === id);
      if (!exists) missing.push(id);
      return exists;
    },
    validateReferenceTypes: false,
  });
  return [
    ...markers.map((marker) => `${marker.level} ${marker.path.join(".")}: ${marker.message}`),
    ...missing.map((id) => `missing reference ${id}`),
  ];
}

describe("fixture documents", () => {
  it("pass the Studio's validation, with every reference pointing at a fixture", async () => {
    for (const document of ALL) {
      expect(await studioMarkers(document), document._id).toEqual([]);
    }
  });

  it("include every fixture venue twice (venue and directory entry), every event, a tier and Site settings", () => {
    const count = (type: string) => ALL.filter((document) => document._type === type).length;
    expect(count("venue")).toBe(VENUES.length);
    expect(count("directoryEntry")).toBe(VENUES.length);
    expect(count("event")).toBe(EVENTS.length);
    expect(count("sponsorTier")).toBe(1);
    expect(count("siteSettings")).toBe(1);
    expect(new Set(ALL.map((document) => document._id)).size).toBe(ALL.length);
  });

  it("keep a venue's directory details and booking contact off the public venue", () => {
    expect(byId("fixture-venue-riverside-tap")).toEqual({
      _id: "fixture-venue-riverside-tap",
      _type: "venue",
      name: "The Riverside Tap",
      address: "22 Front Street, Riverbend",
      mapUrl: "https://example.com/map/the-riverside-tap",
    });
    expect(byId(directoryEntryId("fixture-venue-riverside-tap"))).toEqual({
      _id: "fixture-venue-riverside-tap-directory",
      _type: "directoryEntry",
      venue: { _type: "reference", _ref: "fixture-venue-riverside-tap" },
      capacity: "120",
      pay: "Guarantee plus tips",
      notes: "Backline drum kit.",
      bookingContact: { name: "Darnell Hughes", phone: "(479) 555-0161" },
    });
    // No pay or notes: the fields are left out, not stored empty.
    expect(byId(directoryEntryId("fixture-venue-library"))).toEqual({
      _id: "fixture-venue-library-directory",
      _type: "directoryEntry",
      venue: { _type: "reference", _ref: "fixture-venue-library" },
      capacity: "60",
      bookingContact: { name: "Community room desk", phone: "(479) 555-0163" },
    });
  });

  it("map an event, with its start in Central Time stored in UTC", () => {
    // Nine days after November 27, at 8 PM Central Standard Time.
    expect(byId("fixture-event-delta-night")).toEqual({
      _id: "fixture-event-delta-night",
      _type: "event",
      title: "Delta Night: The Mavis Crane Band",
      slug: { _type: "slug", current: "delta-night-the-mavis-crane-band" },
      start: "2026-12-07T02:00:00.000Z",
      recurrence: { frequency: "none" },
      venue: { _type: "reference", _ref: "fixture-venue-old-mill" },
      category: "concert",
      priceText: "$15",
      memberPrice: "$10",
      visibility: { _type: "visibility", audience: "everyone" },
      body: [
        {
          _type: "block",
          _key: "body",
          style: "normal",
          markDefs: [],
          children: [
            {
              _type: "span",
              _key: "body-text",
              text: "Hill-country grooves and slide guitar. Doors at 7.",
              marks: [],
            },
          ],
        },
      ],
    });
    // Sixty days earlier, in daylight saving time: 6 PM Central Daylight Time.
    expect(byId("fixture-event-summer-finale").start).toBe("2026-09-28T23:00:00.000Z");
  });

  it("map repeats, members-only events and events with no venue or members' price", () => {
    expect(byId("fixture-event-open-jam").recurrence).toEqual({
      frequency: "weekly",
      until: "2027-03-27",
    });
    expect(byId("fixture-event-monthly-jam").recurrence).toEqual({
      frequency: "monthly",
      until: "2027-05-26",
    });
    const social = byId("fixture-event-holiday-social");
    expect(social.visibility).toEqual({ _type: "visibility", audience: "members" });
    expect(social.slug).toEqual({ _type: "slug", current: "members-holiday-social" });
    expect(social).not.toHaveProperty("venue");
    expect(social).not.toHaveProperty("memberPrice");
    expect(byId("fixture-event-annual-meeting").visibility).toEqual({
      _type: "visibility",
      audience: "members",
    });
  });

  it("add the Sponsor tier and Site settings with the board's benefits table", () => {
    expect(byId("fixture-sponsor-tier")).toEqual({
      _id: "fixture-sponsor-tier",
      _type: "sponsorTier",
      name: "Sponsor",
      pricePerYear: 500,
      logoPlacement: "large",
      sortOrder: 1,
    });
    expect(siteSettings).toEqual({
      _id: "siteSettings",
      _type: "siteSettings",
      membershipBenefits: BOARD_BENEFITS,
    });
  });
});

describe("fixtureMutations", () => {
  it("replaces the fixtures, venues first, and creates Site settings only if it's missing", () => {
    const mutations = fixtureMutations(NOW);
    expect(mutations).toEqual([
      ...fixtures.map((document) => ({ createOrReplace: document })),
      { createIfNotExists: siteSettings },
    ]);
    const firstEvent = fixtures.findIndex((document) => document._type === "event");
    expect(fixtures.slice(0, firstEvent).every((d) => d._type !== "event")).toBe(true);
    expect(fixtures.findLastIndex((document) => document._type === "venue")).toBeLessThan(
      firstEvent,
    );
  });

  it("gives the same documents all day in Central Time, so a rerun changes nothing", () => {
    // 12:05 AM and 11:55 PM Central Time on November 27.
    const early = fixtureMutations(new Date("2026-11-27T06:05:00Z"));
    const late = fixtureMutations(new Date("2026-11-28T05:55:00Z"));
    expect(early).toEqual(fixtureMutations(NOW));
    expect(late).toEqual(fixtureMutations(NOW));
    // The next day, every date moves one day along.
    const next = fixtureDocuments(new Date("2026-11-28T18:00:00Z")).fixtures;
    expect(next.find((d) => d._id === "fixture-event-delta-night")?.start).toBe(
      "2026-12-08T02:00:00.000Z",
    );
  });
});

describe("slugFromTitle", () => {
  it("makes a valid web address from a title", () => {
    expect(slugFromTitle("Members' Holiday Social")).toBe("members-holiday-social");
    expect(slugFromTitle("Rhythm & Blues: A Night Out!")).toBe("rhythm-and-blues-a-night-out");
    expect(slugFromTitle(`  ${"Long title ".repeat(12)}`)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slugFromTitle("Long title ".repeat(12)).length).toBeLessThanOrEqual(96);
  });
});

describe("importSanityFixtures", () => {
  const OPTIONS = {
    projectId: "abc12345",
    dataset: "development",
    apiVersion: "2026-11-26",
    token: "sk-test-write-token",
    now: NOW,
  };
  const WHERE = 'dataset "development" of project abc12345';
  const IDS = ALL.map((document) => document._id);

  type Stored = Record<string, unknown> & { _id: string };

  /** JSON with every object's keys sorted, as Sanity returns documents. */
  const sortedKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortedKeys)
      : value !== null && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, sortedKeys((value as Record<string, unknown>)[key])]),
          )
        : value;

  const stored = (document: FixtureDocument, rev = "r0"): Stored =>
    sortedKeys({
      ...document,
      _rev: rev,
      _createdAt: "2026-11-20T00:00:00Z",
      _updatedAt: "2026-11-20T00:00:00Z",
    }) as Stored;

  type Call = { url: URL; init: RequestInit; body: Record<string, unknown> };

  /** A stand-in for Sanity's query and mutate endpoints over an in-memory dataset. */
  function fakeSanity(documents: Stored[] = [], answer?: { status: number; body: string } | Error) {
    const dataset = new Map(documents.map((document) => [document._id, document]));
    const calls: Call[] = [];
    let revision = 0;
    const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url, init: init ?? {}, body });
      if (answer instanceof Error) throw answer;
      if (answer) return new Response(answer.body, { status: answer.status });
      if (url.pathname.endsWith("/data/query/development")) {
        const { ids } = body.params as { ids: string[] };
        return Response.json({ result: ids.flatMap((id) => dataset.get(id) ?? []) });
      }
      revision += 1;
      for (const mutation of body.mutations as Record<string, FixtureDocument>[]) {
        const [kind, document] = Object.entries(mutation)[0];
        if (kind === "createIfNotExists" && dataset.has(document._id)) continue;
        dataset.set(document._id, stored(document, `r${revision}`));
      }
      return Response.json({ transactionId: `t${revision}`, results: [] });
    }) as typeof fetch;
    return { fetchFn, calls, dataset };
  }

  it("reads the fixtures' ids, then writes them all in one transaction, with the token", async () => {
    const { fetchFn, calls, dataset } = fakeSanity();
    const result = await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    expect(result).toEqual({
      ok: true,
      message: `Wrote ${ALL.length} of the ${ALL.length} fixture documents to the ${WHERE}: ${IDS.join(", ")}.`,
    });
    expect(calls).toHaveLength(2);
    const [read, write] = calls;
    expect(read.url.href).toBe(
      "https://abc12345.api.sanity.io/v2026-11-26/data/query/development?perspective=raw",
    );
    expect(read.body).toEqual({ query: "*[_id in $ids]", params: { ids: IDS } });
    expect(write.url.href).toBe(
      "https://abc12345.api.sanity.io/v2026-11-26/data/mutate/development?visibility=sync",
    );
    expect(write.body).toEqual({ mutations: fixtureMutations(NOW) });
    for (const { init } of calls) {
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({ authorization: "Bearer sk-test-write-token" });
    }
    expect([...dataset.keys()].sort()).toEqual([...IDS].sort());
  });

  it("changes nothing when run again the same day", async () => {
    const { fetchFn, calls, dataset } = fakeSanity();
    await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    const revisions = [...dataset.values()].map((document) => document._rev);

    const later = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    const result = await importSanityFixtures({ ...OPTIONS, now: later, fetch: fetchFn });
    expect(result).toEqual({
      ok: true,
      message: `Nothing to write: the ${ALL.length} fixture documents in the ${WHERE} are up to date.`,
    });
    expect(calls).toHaveLength(3); // The second run only read.
    expect([...dataset.values()].map((document) => document._rev)).toEqual(revisions);
  });

  it("rewrites only fixtures that differ, and keeps Site settings as an editor left it", async () => {
    const edited = { ...stored(byId("fixture-event-duo-night")), title: "Changed in the Studio" };
    const settings = { ...stored(siteSettings), footerText: "Edited by an editor." };
    const { fetchFn, calls, dataset } = fakeSanity([
      ...fixtures
        .filter(({ _id }) => _id !== "fixture-venue-bluebird")
        .map((document) => (document._id === edited._id ? edited : stored(document))),
      settings,
    ]);
    const result = await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    expect(result).toEqual({
      ok: true,
      message: `Wrote 2 of the ${ALL.length} fixture documents to the ${WHERE} (${ALL.length - 2} were up to date): fixture-venue-bluebird, fixture-event-duo-night.`,
    });
    expect(calls[1].body).toEqual({
      mutations: [
        { createOrReplace: byId("fixture-venue-bluebird") },
        { createOrReplace: byId("fixture-event-duo-night") },
      ],
    });
    expect(dataset.get("siteSettings")).toEqual(settings);
  });

  it("moves the events' dates along the next day, and nothing else", async () => {
    const { fetchFn, calls } = fakeSanity();
    await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const result = await importSanityFixtures({ ...OPTIONS, now: tomorrow, fetch: fetchFn });
    expect(result.message).toContain(`Wrote ${EVENTS.length} of the ${ALL.length}`);
    const written = (calls[3].body.mutations as { createOrReplace: FixtureDocument }[]).map(
      ({ createOrReplace }) => createOrReplace._type,
    );
    expect(new Set(written)).toEqual(new Set(["event"]));
  });

  it("writes nothing to any dataset but development", async () => {
    const { fetchFn, calls } = fakeSanity();
    const result = await importSanityFixtures({
      ...OPTIONS,
      dataset: "production",
      fetch: fetchFn,
    });
    expect(result).toEqual({
      ok: false,
      message:
        'The fixtures go only into the development dataset, and NEXT_PUBLIC_SANITY_DATASET is "production". Nothing was written.',
    });
    expect(calls).toHaveLength(0);
  });

  it("asks for a write token when there is none", async () => {
    const { fetchFn, calls } = fakeSanity();
    const result = await importSanityFixtures({ ...OPTIONS, token: undefined, fetch: fetchFn });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SANITY_API_WRITE_TOKEN isn't set");
    expect(calls).toHaveLength(0);
  });

  it("reports Sanity's refusal without showing the token", async () => {
    const { fetchFn, calls } = fakeSanity([], {
      status: 403,
      body: '{"error":"Insufficient permissions","token":"sk-test-write-token"}',
    });
    const result = await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    expect(result).toEqual({
      ok: false,
      message: `Sanity answered 403: {"error":"Insufficient permissions","token":"[token]"} (${WHERE}). Nothing was written.`,
    });
    expect(calls).toHaveLength(1);
  });

  it("reports a network failure", async () => {
    const { fetchFn } = fakeSanity([], new TypeError("fetch failed"));
    const result = await importSanityFixtures({ ...OPTIONS, fetch: fetchFn });
    expect(result).toEqual({
      ok: false,
      message: `Sanity couldn't be reached: TypeError: fetch failed (${WHERE}). Nothing was written.`,
    });
  });
});
