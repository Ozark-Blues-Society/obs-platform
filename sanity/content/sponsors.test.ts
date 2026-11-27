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

const { CURRENT_SPONSORS_QUERY, getCurrentSponsors, listCurrentSponsors, parseSponsors } =
  await import("./sponsors");

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
    { _id: "tier-gold", _type: "sponsorTier", name: "Gold", sortOrder: 1 },
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
      name: "Beta Brewing",
      tier: { _ref: "tier-gold" },
      endsAt: "2026-12-31",
    },
    // Ended the day before $today: never shown.
    { _id: "sp-gone", _type: "sponsor", name: "Gone Diner", endsAt: "2026-11-26" },
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
      name: "alpha Guitars",
      website: "https://alpha.example.com",
      logo: { asset: { _ref: LOGO }, crop: null, hotspot: null, alt: "Alpha logo" },
    });
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
