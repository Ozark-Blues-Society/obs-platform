// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/members/access";

const mocks = vi.hoisted(() => ({
  isConfigured: true,
  connection: vi.fn(async () => {}),
  sanityFetch: vi.fn(),
  getDynamicFetchOptions: vi.fn(),
  getViewer: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
// next-sanity/live only runs in React Server Components (see ../live.test.ts).
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

const { DIRECTORY_QUERY, listDirectory, parseDirectory } = await import("./directory");

/** In every booking contact field: no answer for someone who may not see contacts holds it. */
const CONTACT_MARKER = "CONTACT-ONLY-91c4";

/** `text` followed by invisible edit markers, as a preview sends it (@vercel/stega's encoding). */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

const DATASET = [
  { _id: "venue-old-mill", _type: "venue", name: "Old Mill Music Hall", address: "1 Mill St" },
  { _id: "venue-bluebird", _type: "venue", name: "The Bluebird Lounge", address: "2 Elm St" },
  {
    _id: "entry-old-mill",
    _type: "directoryEntry",
    venue: { _type: "reference", _ref: "venue-old-mill" },
    capacity: "350",
    pay: "Door split",
    notes: "Sound tech provided",
    bookingContact: {
      name: `Sam Ortega ${CONTACT_MARKER}`,
      email: `booking-${CONTACT_MARKER}@example.com`,
      phone: `(479) 555-0100 ${CONTACT_MARKER}`,
    },
  },
  {
    _id: "entry-bluebird",
    _type: "directoryEntry",
    venue: { _type: "reference", _ref: "venue-bluebird" },
    capacity: "80",
  },
  // Not finished yet: no venue picked.
  { _id: "entry-no-venue", _type: "directoryEntry", capacity: "12" },
  // An event at the Old Mill: its venue is public, and holds no contact.
  {
    _id: "event-jam",
    _type: "event",
    title: "Friday jam",
    venue: { _type: "reference", _ref: "venue-old-mill" },
  },
];

async function run(query: string, params: Record<string, unknown>): Promise<unknown> {
  return (await evaluate(parse(query), { dataset: DATASET, params })).get();
}

describe("DIRECTORY_QUERY", () => {
  it("returns no entries at all without an active member's level", async () => {
    await expect(run(DIRECTORY_QUERY, { memberLevel: null })).resolves.toEqual([]);
  });

  it("gives Individual members the venues and their details, with no booking contact", async () => {
    const result = await run(DIRECTORY_QUERY, { memberLevel: "individual" });
    expect(result).toEqual([
      {
        _id: "entry-old-mill",
        venue: { name: "Old Mill Music Hall" },
        capacity: "350",
        pay: "Door split",
        notes: "Sound tech provided",
        bookingContact: null,
      },
      {
        _id: "entry-bluebird",
        venue: { name: "The Bluebird Lounge" },
        capacity: "80",
        pay: null,
        notes: null,
        bookingContact: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(CONTACT_MARKER);
  });

  it("adds the booking contact for Band, Business and Sponsor members", async () => {
    for (const memberLevel of ["band", "business", "sponsor"]) {
      const result = (await run(DIRECTORY_QUERY, { memberLevel })) as {
        bookingContact: unknown;
      }[];
      expect(
        result.map((entry) => entry.bookingContact),
        memberLevel,
      ).toEqual([
        {
          name: `Sam Ortega ${CONTACT_MARKER}`,
          email: `booking-${CONTACT_MARKER}@example.com`,
          phone: `(479) 555-0100 ${CONTACT_MARKER}`,
        },
        null,
      ]);
    }
  });

  it("gives an unknown level no contacts", async () => {
    for (const memberLevel of ["family", "Band", ""]) {
      const result = await run(DIRECTORY_QUERY, { memberLevel });
      expect(JSON.stringify(result), memberLevel).not.toContain(CONTACT_MARKER);
    }
  });

  it("takes only the venue's name from the venue", () => {
    expect(DIRECTORY_QUERY).toContain('"venue": venue->{ name }');
    expect(DIRECTORY_QUERY).not.toContain("...");
  });
});

describe("an event's venue", () => {
  it("holds no booking contact, so an event page can't show one", async () => {
    // How events read their venue (backlog P-2): the venue holds only public fields, and the
    // contact sits on the Directory entry, which points at the venue, not the other way round.
    const result = await run(
      '*[_type == "event"]{ title, "venue": venue->{ name, address, mapUrl } }',
      {},
    );
    expect(result).toEqual([
      {
        title: "Friday jam",
        venue: { name: "Old Mill Music Hall", address: "1 Mill St", mapUrl: null },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(CONTACT_MARKER);
  });
});

describe("parseDirectory", () => {
  const entry = (overrides: object = {}) => ({
    _id: "entry-1",
    venue: { name: "Old Mill Music Hall" },
    capacity: "350",
    pay: "Door split",
    notes: "Sound tech provided",
    bookingContact: { name: "Sam Ortega", email: "booking@example.com", phone: null },
    ...overrides,
  });

  it("turns entries into rows by venue name, ignoring case", () => {
    const rows = parseDirectory(
      [
        entry({ _id: "e-3", venue: { name: "the Riverside Tap" } }),
        entry({ _id: "e-1", venue: { name: "Bluebird Lounge" } }),
        entry({ _id: "e-2", venue: { name: "Old Mill Music Hall" } }),
      ],
      true,
    );
    expect(rows.map((row) => row.id)).toEqual(["e-1", "e-2", "e-3"]);
    expect(rows[1]).toEqual({
      id: "e-2",
      venue: "Old Mill Music Hall",
      capacity: "350",
      pay: "Door split",
      notes: "Sound tech provided",
      contact: { name: "Sam Ortega", email: "booking@example.com" },
    });
  });

  it("leaves booking contacts out unless they're for this viewer, whatever Sanity sent", () => {
    const [row] = parseDirectory([entry()], false);
    expect(row.contact).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain("Sam Ortega");
  });

  it("has no contact for an entry whose contact is empty", () => {
    for (const bookingContact of [null, {}, { name: " ", email: "", phone: null }]) {
      const [row] = parseDirectory([entry({ bookingContact })], true);
      expect(row.contact, JSON.stringify(bookingContact)).toBeUndefined();
    }
  });

  it("skips entries without a venue name, and answers that aren't a list of entries", () => {
    expect(
      parseDirectory(
        [
          entry({ venue: null }),
          entry({ venue: { name: "  " } }),
          entry({ _id: null }),
          "not an entry",
          null,
        ],
        true,
      ),
    ).toEqual([]);
    expect(parseDirectory(null, true)).toEqual([]);
    expect(parseDirectory({ _id: "entry-1" }, true)).toEqual([]);
  });

  it("keeps a preview's edit markers on text, and sorts by the text without them", () => {
    const marked = withEditMarker("Zydeco Hall");
    const rows = parseDirectory(
      [
        entry({ _id: "e-z", venue: { name: marked }, notes: withEditMarker("Notes") }),
        entry({ _id: "e-a", venue: { name: withEditMarker("Acoustic Barn") } }),
      ],
      true,
    );
    expect(rows.map((row) => row.id)).toEqual(["e-a", "e-z"]);
    expect(rows[1].venue).toBe(marked);
    expect(rows[1].notes).toBe(withEditMarker("Notes"));
  });
});

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const member = (level: "individual" | "band" | "sponsor" | null, expiresAt: string | null) =>
  ({
    kind: "member",
    userId: "00000000-0000-4000-8100-000000000018",
    level,
    expiresAt,
  }) satisfies Viewer;

describe("listDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConfigured = true;
    mocks.getDynamicFetchOptions.mockResolvedValue({ perspective: "published", stega: false });
  });

  it("doesn't ask Sanity for anyone without an active membership, and says why", async () => {
    const cases: [Viewer, string][] = [
      [{ kind: "visitor" }, "sign-in"],
      [member(null, null), "join"],
      [member("band", inDays(-1)), "renew"],
      [member("sponsor", new Date(Date.now() - 1000).toISOString()), "renew"],
    ];
    for (const [viewer, reason] of cases) {
      mocks.getViewer.mockResolvedValueOnce(viewer);
      await expect(listDirectory()).resolves.toEqual({
        access: { allowed: false, reason },
        contacts: false,
        entries: [],
      });
    }
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
    expect(mocks.connection).toHaveBeenCalledTimes(cases.length);
  });

  it("asks Sanity with the member's level, and keeps the contacts for Band and up", async () => {
    mocks.getViewer.mockResolvedValue(member("band", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({
      data: [
        {
          _id: "entry-old-mill",
          venue: { name: "Old Mill Music Hall" },
          bookingContact: { name: "Sam Ortega" },
        },
      ],
    });
    await expect(listDirectory()).resolves.toEqual({
      access: { allowed: true },
      contacts: true,
      entries: [
        {
          id: "entry-old-mill",
          venue: "Old Mill Music Hall",
          capacity: undefined,
          pay: undefined,
          notes: undefined,
          contact: { name: "Sam Ortega" },
        },
      ],
    });
    expect(mocks.sanityFetch).toHaveBeenCalledWith({
      query: DIRECTORY_QUERY,
      params: { memberLevel: "band" },
      perspective: "published",
      stega: false,
    });
  });

  it("drops contacts for an Individual member even if Sanity sent some", async () => {
    mocks.getViewer.mockResolvedValue(member("individual", inDays(30)));
    mocks.sanityFetch.mockResolvedValue({
      data: [
        {
          _id: "entry-old-mill",
          venue: { name: "Old Mill Music Hall" },
          bookingContact: { name: "Sam Ortega" },
        },
      ],
    });
    const directory = await listDirectory();
    expect(directory.contacts).toBe(false);
    expect(directory.entries).toHaveLength(1);
    expect(JSON.stringify(directory)).not.toContain("Sam Ortega");
    expect(mocks.sanityFetch).toHaveBeenCalledWith(
      expect.objectContaining({ params: { memberLevel: "individual" } }),
    );
  });

  it("follows a preview's perspective, for the member's own level only", async () => {
    mocks.getViewer.mockResolvedValue(member("sponsor", inDays(3)));
    mocks.getDynamicFetchOptions.mockResolvedValue({ perspective: "drafts", stega: true });
    mocks.sanityFetch.mockResolvedValue({ data: [] });
    await expect(listDirectory()).resolves.toEqual({
      access: { allowed: true },
      contacts: true,
      entries: [],
    });
    expect(mocks.sanityFetch).toHaveBeenCalledWith({
      query: DIRECTORY_QUERY,
      params: { memberLevel: "sponsor" },
      perspective: "drafts",
      stega: true,
    });
  });

  it("reads nothing without a Sanity project", async () => {
    mocks.isConfigured = false;
    mocks.getViewer.mockResolvedValue(member("band", inDays(30)));
    await expect(listDirectory()).resolves.toEqual({
      access: { allowed: true },
      contacts: true,
      entries: [],
    });
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
  });
});
