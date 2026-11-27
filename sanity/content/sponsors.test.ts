// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
  getDynamicFetchOptions: vi.fn(async () => ({ perspective: "published", stega: false })),
  cacheLife: vi.fn(),
  connection: vi.fn(async () => {}),
  isConfigured: true,
}));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
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

const {
  CURRENT_SPONSORS_QUERY,
  getCurrentSponsors,
  groupSponsorsByTier,
  listCurrentSponsors,
  parseSponsors,
  pickFeaturedSponsor,
} = await import("./sponsors");
type CurrentSponsor = import("./sponsors").CurrentSponsor;
type SponsorTier = import("./sponsors").SponsorTier;

/** `text` followed by invisible edit markers, as a preview sends it (@vercel/stega's encoding). */
function withEditMarker(text: string): string {
  const digits = [0x200b, 0x200c, 0x200d, 0xfeff].map((code) => String.fromCharCode(code));
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

const LOGO = "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-400x100-png";

describe("CURRENT_SPONSORS_QUERY", () => {
  const dataset = [
    {
      _id: "tier-gold",
      _type: "sponsorTier",
      name: "Gold",
      sortOrder: 1,
      logoPlacement: "large",
      pricePerYear: 1000,
      benefits: ["Large logo"],
    },
    { _id: "tier-friend", _type: "sponsorTier", name: "Friend", sortOrder: 3 },
    { _id: "sp-zeta", _type: "sponsor", name: "Zeta Music", tier: { _ref: "tier-gold" } },
    {
      _id: "sp-alpha",
      _type: "sponsor",
      name: "alpha Guitars",
      tier: { _ref: "tier-friend" },
      endsAt: "2026-11-27",
      website: "https://alpha.example.com",
      logo: { asset: { _ref: LOGO }, alt: "Alpha logo", extra: "not asked for" },
    },
    {
      _id: "sp-beta",
      _type: "sponsor",
      _updatedAt: "2026-11-20T10:00:00Z",
      name: "Beta Brewing",
      tier: { _ref: "tier-gold" },
      endsAt: "2026-12-31",
      featured: true,
      blurb: "Beta hosts the jam.",
    },
    // Ended the day before $today: never shown, featured or not.
    {
      _id: "sp-gone",
      _type: "sponsor",
      name: "Gone Diner",
      endsAt: "2026-11-26",
      featured: true,
      blurb: "Gone's spotlight.",
    },
    // No tier yet: after the ones with a tier.
    { _id: "sp-untiered", _type: "sponsor", name: "Aardvark Audio" },
    { _id: "page-x", _type: "page", name: "Not a sponsor" },
  ];

  async function run(ids: string[], today = "2026-11-27") {
    const value = await evaluate(parse(CURRENT_SPONSORS_QUERY), {
      dataset,
      params: { ids, today },
    });
    return (await value.get()) as { _id: string }[];
  }

  it("lists every current sponsor by tier and then name, until the day after its last day", async () => {
    const sponsors = await run([]);
    expect(sponsors.map((sponsor) => sponsor._id)).toEqual([
      "sp-beta",
      "sp-zeta",
      "sp-alpha",
      "sp-untiered",
    ]);
    expect(sponsors[2]).toEqual({
      _id: "sp-alpha",
      _updatedAt: null,
      name: "alpha Guitars",
      website: "https://alpha.example.com",
      logo: { asset: { _ref: LOGO }, crop: null, hotspot: null, alt: "Alpha logo" },
      featured: null,
      blurb: null,
      tier: {
        _id: "tier-friend",
        name: "Friend",
        logoPlacement: null,
        sortOrder: 3,
        pricePerYear: null,
        benefits: null,
      },
    });
    // The featured sponsor's spotlight comes with it, and its tier's details.
    expect(sponsors[0]).toMatchObject({
      _id: "sp-beta",
      _updatedAt: "2026-11-20T10:00:00Z",
      featured: true,
      blurb: "Beta hosts the jam.",
      tier: {
        _id: "tier-gold",
        name: "Gold",
        logoPlacement: "large",
        sortOrder: 1,
        pricePerYear: 1000,
        benefits: ["Large logo"],
      },
    });
    // A sponsor without a tier has none.
    expect(sponsors[3]).toMatchObject({ _id: "sp-untiered", tier: null });
    // The day after alpha's last day, it's gone too.
    expect((await run([], "2026-11-28")).map((sponsor) => sponsor._id)).not.toContain("sp-alpha");
  });

  it("lists only the sponsors picked, among the current ones", async () => {
    const sponsors = await run(["sp-zeta", "sp-gone", "sp-alpha"]);
    expect(sponsors.map((sponsor) => sponsor._id)).toEqual(["sp-zeta", "sp-alpha"]);
  });
});

describe("parseSponsors", () => {
  it("keeps the name for display, a safe website and the logo with alt text", () => {
    const name = withEditMarker("Riverbend Brewing Co.");
    expect(
      parseSponsors(
        [
          {
            _id: withEditMarker("sp-1"),
            name,
            website: withEditMarker("https://riverbend.example.com"),
            logo: { asset: { _ref: LOGO } },
          },
          { _id: "sp-2", name: "Hilltop Guitar Works", website: "javascript:alert(1)" },
          { _id: "sp-3", name: "Mailto Records", website: "mailto:hi@example.com" },
          { _id: "sp-4", name: "  " },
          { name: "No id" },
          "not a sponsor",
        ],
        [],
      ),
    ).toEqual([
      {
        id: "sp-1",
        name,
        website: "https://riverbend.example.com/",
        logo: { image: { asset: { _ref: LOGO } }, alt: "Riverbend Brewing Co." },
      },
      { id: "sp-2", name: "Hilltop Guitar Works", website: undefined, logo: undefined },
      { id: "sp-3", name: "Mailto Records", website: undefined, logo: undefined },
    ]);
    expect(parseSponsors(null, [])).toEqual([]);
  });

  it("keeps the editor's order for picked sponsors", () => {
    const data = ["a", "b", "c"].map((id) => ({ _id: id, name: id.toUpperCase() }));
    expect(parseSponsors(data, ["c", "a", "b"]).map((sponsor) => sponsor.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("keeps the tier, the spotlight text and when the sponsor last changed", () => {
    const tierName = withEditMarker("Gold");
    const benefit = withEditMarker("Large logo on the Sponsors page");
    const blurb = withEditMarker("Beta hosts the Tuesday jam.");
    expect(
      parseSponsors(
        [
          {
            _id: "sp-1",
            _updatedAt: "2026-11-20T10:00:00Z",
            name: "Beta Brewing",
            featured: true,
            blurb,
            tier: {
              _id: withEditMarker("tier-gold"),
              name: tierName,
              logoPlacement: withEditMarker("large"),
              sortOrder: 1,
              pricePerYear: 1000,
              benefits: [benefit, "  ", null, 7],
            },
          },
          {
            _id: "sp-2",
            name: "Zeta Music",
            featured: "yes",
            blurb: "  ",
            tier: {
              _id: "tier-x",
              name: "X",
              logoPlacement: "huge",
              sortOrder: "1",
              pricePerYear: -5,
            },
          },
          { _id: "sp-3", name: "Aardvark Audio", tier: { _id: "tier-y", name: " " } },
        ],
        [],
      ),
    ).toEqual([
      {
        id: "sp-1",
        name: "Beta Brewing",
        website: undefined,
        logo: undefined,
        featured: true,
        blurb,
        updatedAt: "2026-11-20T10:00:00Z",
        tier: {
          id: "tier-gold",
          name: tierName,
          logoPlacement: "large",
          sortOrder: 1,
          pricePerYear: 1000,
          benefits: [benefit],
        },
      },
      // Featured only when it's true, a blank blurb is none, and an unknown placement shows logos.
      {
        id: "sp-2",
        name: "Zeta Music",
        website: undefined,
        logo: undefined,
        tier: { id: "tier-x", name: "X", logoPlacement: "logo", benefits: [] },
      },
      // A tier without a name is no tier.
      { id: "sp-3", name: "Aardvark Audio", website: undefined, logo: undefined },
    ]);
  });
});

/** A sponsor as parseSponsors returns it. */
function sponsorWith(id: string, extra: Partial<CurrentSponsor> = {}): CurrentSponsor {
  return { id, name: `Sponsor ${id}`, ...extra };
}

describe("pickFeaturedSponsor", () => {
  it("picks the featured sponsor changed most recently, whatever the order", () => {
    const older = sponsorWith("sp-older", { featured: true, updatedAt: "2026-11-01T10:00:00Z" });
    const newer = sponsorWith("sp-newer", { featured: true, updatedAt: "2026-11-20T10:00:00Z" });
    const notFeatured = sponsorWith("sp-plain", { updatedAt: "2026-11-25T10:00:00Z" });
    const sponsors = [older, notFeatured, newer];

    expect(pickFeaturedSponsor(sponsors)).toBe(newer);
    expect(pickFeaturedSponsor([newer, notFeatured, older])).toBe(newer);
    // The list stays as it was.
    expect(sponsors).toEqual([older, notFeatured, newer]);
  });

  it("settles a tie by id, and puts a sponsor that says when it changed first", () => {
    const changed = "2026-11-20T10:00:00Z";
    const b = sponsorWith("sp-b", { featured: true, updatedAt: changed });
    const a = sponsorWith("sp-a", { featured: true, updatedAt: changed });
    expect(pickFeaturedSponsor([b, a])).toBe(a);
    expect(pickFeaturedSponsor([a, b])).toBe(a);

    const undated = [
      sponsorWith("sp-z", { featured: true }),
      sponsorWith("sp-y", { featured: true }),
    ];
    expect(pickFeaturedSponsor(undated)?.id).toBe("sp-y");
    expect(pickFeaturedSponsor([...undated, b])).toBe(b);
  });

  it("picks none when no sponsor is featured", () => {
    expect(
      pickFeaturedSponsor([sponsorWith("sp-1"), sponsorWith("sp-2", { featured: false })]),
    ).toBeUndefined();
    expect(pickFeaturedSponsor([])).toBeUndefined();
  });
});

describe("groupSponsorsByTier", () => {
  const tier = (id: string, name: string, sortOrder?: number): SponsorTier => ({
    id,
    name,
    logoPlacement: "logo",
    benefits: [],
    ...(sortOrder !== undefined && { sortOrder }),
  });

  it("groups the sponsors by tier in the tiers' order, the sponsors without a tier last", () => {
    const gold = tier("tier-gold", "Gold", 1);
    const friend = tier("tier-friend", "Friend", 3);
    // The same order as Friend: by name, whatever the case.
    const silver = tier("tier-silver", "silver", 3);
    // No order: after the tiers that have one.
    const fresh = tier("tier-new", "A new tier");
    const sponsors = [
      sponsorWith("a", { tier: friend }),
      sponsorWith("b", { tier: gold }),
      sponsorWith("c"),
      sponsorWith("d", { tier: silver }),
      sponsorWith("e", { tier: friend }),
      sponsorWith("f", { tier: fresh }),
      sponsorWith("g", { tier: gold }),
    ];

    expect(
      groupSponsorsByTier(sponsors).map((group) => [
        group.tier?.name,
        group.sponsors.map((sponsor) => sponsor.id),
      ]),
    ).toEqual([
      ["Gold", ["b", "g"]],
      ["Friend", ["a", "e"]],
      ["silver", ["d"]],
      ["A new tier", ["f"]],
      [undefined, ["c"]],
    ]);
  });

  it("has no groups without sponsors", () => {
    expect(groupSponsorsByTier([])).toEqual([]);
  });
});

describe("listCurrentSponsors", () => {
  beforeEach(() => {
    mocks.sanityFetch.mockReset();
    mocks.cacheLife.mockReset();
    mocks.isConfigured = true;
    vi.useRealTimers();
  });

  it("asks for the sponsors current on today's date in Central Time, in this perspective", async () => {
    // 1:30 AM UTC on Nov 28 is still Nov 27 in Central Time.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-28T01:30:00Z") });
    mocks.getDynamicFetchOptions.mockResolvedValueOnce({ perspective: "drafts", stega: true });
    mocks.sanityFetch.mockResolvedValueOnce({ data: [{ _id: "sp-1", name: "One" }] });

    await expect(listCurrentSponsors(["sp-1"])).resolves.toEqual([
      { id: "sp-1", name: "One", website: undefined, logo: undefined },
    ]);
    expect(mocks.connection).toHaveBeenCalled();
    expect(mocks.sanityFetch).toHaveBeenCalledWith({
      query: CURRENT_SPONSORS_QUERY,
      params: { ids: ["sp-1"], today: "2026-11-27" },
      perspective: "drafts",
      stega: true,
    });
  });

  // Sanity answers the query from this dataset, as it would on the day the fake clock says.
  const ENDING_DATASET = (endsAt: string) => [
    { _id: "tier-1", _type: "sponsorTier", name: "Sponsor", sortOrder: 1, logoPlacement: "logo" },
    {
      _id: "sp-ending",
      _type: "sponsor",
      _updatedAt: "2026-11-25T12:00:00Z",
      name: "Ending Records",
      tier: { _ref: "tier-1" },
      featured: true,
      blurb: "Ending Records' spotlight.",
      endsAt,
    },
    {
      _id: "sp-staying",
      _type: "sponsor",
      _updatedAt: "2026-11-01T12:00:00Z",
      name: "Staying Music",
      tier: { _ref: "tier-1" },
      featured: true,
      blurb: "Staying Music's spotlight.",
    },
  ];

  it.each([
    // Central Standard Time (UTC-6) and Central Daylight Time (UTC-5).
    { endsAt: "2026-11-30", lastMinute: "2026-12-01T05:59:59Z", midnight: "2026-12-01T06:00:00Z" },
    { endsAt: "2027-06-30", lastMinute: "2027-07-01T04:59:59Z", midnight: "2027-07-01T05:00:00Z" },
  ])(
    "hides a sponsor whose last day was $endsAt, and its spotlight, at midnight Central Time",
    async ({ endsAt, lastMinute, midnight }) => {
      const dataset = ENDING_DATASET(endsAt);
      mocks.sanityFetch.mockImplementation(
        async ({ query, params }: { query: string; params: Record<string, unknown> }) => ({
          data: await (await evaluate(parse(query), { dataset, params })).get(),
        }),
      );

      // A minute before midnight on its last day, in Central Time: still a sponsor, and featured.
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(lastMinute) });
      let sponsors = await listCurrentSponsors([]);
      expect(sponsors.map((sponsor) => sponsor.id)).toEqual(["sp-ending", "sp-staying"]);
      expect(pickFeaturedSponsor(sponsors)?.id).toBe("sp-ending");

      // Midnight: gone by itself, and the other featured sponsor's spotlight shows instead.
      vi.setSystemTime(new Date(midnight));
      sponsors = await listCurrentSponsors([]);
      expect(sponsors.map((sponsor) => sponsor.id)).toEqual(["sp-staying"]);
      expect(pickFeaturedSponsor(sponsors)?.id).toBe("sp-staying");
    },
  );

  it("shows none without a Sanity project, and none for a few minutes if Sanity fails", async () => {
    mocks.isConfigured = false;
    await expect(
      getCurrentSponsors([], "2026-11-27", { perspective: "published", stega: false }),
    ).resolves.toEqual([]);
    expect(mocks.sanityFetch).not.toHaveBeenCalled();

    mocks.isConfigured = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sanityFetch.mockRejectedValueOnce(new Error("Sanity is down"));
    await expect(
      getCurrentSponsors([], "2026-11-27", { perspective: "published", stega: false }),
    ).resolves.toEqual([]);
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
