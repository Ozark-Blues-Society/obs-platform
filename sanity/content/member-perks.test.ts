// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/members/access";
import type { MembershipLevel } from "@/sanity/schemas/options";

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

const { MEMBER_PERKS_QUERY, getMemberPerks, parseMemberPerks } = await import("./member-perks");

const ALL: MembershipLevel[] = ["individual", "band", "business", "sponsor"];

/** Site settings as editors keep them, with a perk code for everyone and one for sponsors. */
const SITE_SETTINGS = {
  _id: "siteSettings",
  _type: "siteSettings",
  footerText: "A community nonprofit.",
  membershipBenefits: [
    { _type: "benefit", _key: "classifieds", benefit: "Post in the classifieds", levels: ALL },
    {
      _type: "benefit",
      _key: "sponsor-discount",
      benefit: "10% off paid Society events and other paid items",
      levels: ["sponsor"],
    },
    {
      _type: "benefit",
      _key: "booking-contacts",
      benefit: "Venue directory: booking contacts",
      levels: ["band", "business", "sponsor"],
    },
  ],
  perkCodes: [
    {
      _type: "perkCode",
      _key: "member",
      label: "Member discount code",
      code: "BLUES-MBR-26",
      details: "15% off Society merchandise (not bulk orders).",
      levels: ALL,
    },
    {
      _type: "perkCode",
      _key: "sponsor",
      label: "Sponsor discount code",
      code: "BLUES-SPN-26",
      levels: ["sponsor"],
    },
  ],
};

async function runQuery(memberLevel: string | null, documents: object[] = [SITE_SETTINGS]) {
  const result = await evaluate(parse(MEMBER_PERKS_QUERY), {
    dataset: documents,
    params: { memberLevel },
  });
  return result.get();
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const member = (level: MembershipLevel | null, expiresAt: string | null): Viewer => ({
  kind: "member",
  userId: "00000000-0000-4000-8100-000000000036",
  level,
  expiresAt,
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
  mocks.getViewer.mockResolvedValue({ kind: "visitor" });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("MEMBER_PERKS_QUERY", () => {
  it("returns nothing at all without an active member's level", async () => {
    expect(await runQuery(null)).toBeNull();
  });

  it("returns only the benefits and perk codes of the member's level", async () => {
    expect(await runQuery("individual")).toEqual({
      benefits: [{ _key: "classifieds", benefit: "Post in the classifieds", levels: ALL }],
      perkCodes: [
        {
          _key: "member",
          label: "Member discount code",
          code: "BLUES-MBR-26",
          details: "15% off Society merchandise (not bulk orders).",
          levels: ALL,
        },
      ],
    });
    const sponsor = (await runQuery("sponsor")) as { benefits: object[]; perkCodes: object[] };
    expect(sponsor.benefits).toHaveLength(3);
    expect(sponsor.perkCodes.map((row) => (row as { code: string }).code)).toEqual([
      "BLUES-MBR-26",
      "BLUES-SPN-26",
    ]);
  });

  it("copes with Site settings that have no perk codes or benefits yet, or don't exist", async () => {
    expect(await runQuery("band", [{ _id: "siteSettings", _type: "siteSettings" }])).toEqual({
      benefits: null,
      perkCodes: null,
    });
    expect(await runQuery("band", [])).toBeNull();
  });
});

describe("parseMemberPerks", () => {
  it("keeps the rows for the level in the editors' order", async () => {
    expect(parseMemberPerks(await runQuery("band"), "band")).toEqual({
      benefits: [
        { key: "classifieds", text: "Post in the classifieds" },
        { key: "booking-contacts", text: "Venue directory: booking contacts" },
      ],
      perkCodes: [
        {
          key: "member",
          label: "Member discount code",
          code: "BLUES-MBR-26",
          details: "15% off Society merchandise (not bulk orders).",
        },
      ],
    });
  });

  it("drops a row for other levels even if Sanity sent it", () => {
    const sent = {
      benefits: SITE_SETTINGS.membershipBenefits,
      perkCodes: SITE_SETTINGS.perkCodes,
    };
    const individual = parseMemberPerks(sent, "individual");
    expect(individual.perkCodes.map((code) => code.code)).toEqual(["BLUES-MBR-26"]);
    expect(individual.benefits.map((benefit) => benefit.key)).toEqual(["classifieds"]);
  });

  it("skips incomplete rows and anything that isn't a row", () => {
    expect(
      parseMemberPerks(
        {
          benefits: [{ _key: "a", levels: ALL }, { _key: "b", benefit: " ", levels: ALL }, "x"],
          perkCodes: [
            { _key: "c", label: "No code", levels: ALL },
            { _key: "d", code: "NO-LABEL", levels: ALL },
            { _key: "e", label: "No levels", code: "NO-LEVELS" },
            { label: "No key", code: "NO-KEY", levels: ALL },
            null,
          ],
        },
        "band",
      ),
    ).toEqual({ benefits: [], perkCodes: [] });
    expect(parseMemberPerks(null, "band")).toEqual({ benefits: [], perkCodes: [] });
  });

  it("cleans a preview's edit markers out of the code, which members copy, and the levels", () => {
    const label = withEditMarker("Member discount code");
    const parsed = parseMemberPerks(
      {
        benefits: [],
        perkCodes: [
          {
            _key: "member",
            label,
            code: withEditMarker(" BLUES-MBR-26 "),
            levels: [withEditMarker("band")],
          },
        ],
      },
      "band",
    );
    expect(parsed.perkCodes).toEqual([{ key: "member", label, code: "BLUES-MBR-26" }]);
  });
});

describe("getMemberPerks", () => {
  it("doesn't ask Sanity for anyone without an active membership", async () => {
    for (const viewer of [
      { kind: "visitor" },
      member(null, null),
      member("sponsor", inDays(-1)),
      member(null, inDays(30)),
    ]) {
      mocks.getViewer.mockResolvedValueOnce(viewer);
      expect(await getMemberPerks()).toEqual({
        level: null,
        benefits: [],
        perkCodes: [],
      });
    }
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
    expect(mocks.connection).toHaveBeenCalledTimes(4);
  });

  it("asks Sanity with the member's active level, in the preview's perspective", async () => {
    mocks.getViewer.mockResolvedValue(member("sponsor", inDays(100)));
    mocks.getDynamicFetchOptions.mockResolvedValue({ perspective: "drafts", stega: true });
    mocks.sanityFetch.mockResolvedValue({ data: await runQuery("sponsor") });

    const perks = await getMemberPerks();

    expect(mocks.sanityFetch).toHaveBeenCalledWith({
      query: MEMBER_PERKS_QUERY,
      params: { memberLevel: "sponsor" },
      perspective: "drafts",
      stega: true,
    });
    expect(perks.level).toBe("sponsor");
    expect(perks.perkCodes.map((code) => code.code)).toEqual(["BLUES-MBR-26", "BLUES-SPN-26"]);
    expect(perks.benefits).toHaveLength(3);
    expect(perks.unavailable).toBeUndefined();
  });

  it("has no perks without a Sanity project", async () => {
    mocks.isConfigured = false;
    mocks.getViewer.mockResolvedValue(member("band", inDays(100)));
    expect(await getMemberPerks()).toEqual({ level: "band", benefits: [], perkCodes: [] });
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
  });

  it("says the perks are unavailable when Sanity can't be reached, without throwing", async () => {
    mocks.getViewer.mockResolvedValue(member("band", inDays(100)));
    mocks.sanityFetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    expect(await getMemberPerks()).toEqual({
      level: "band",
      benefits: [],
      perkCodes: [],
      unavailable: true,
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
