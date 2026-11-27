// The current sponsors: every sponsor whose sponsorship hasn't ended, or the ones an editor picked
// for a page's "Sponsor logos" block (backlog C-2). A sponsorship's endsAt is a date in Central
// Time, and the sponsor disappears the day after it. The Sponsors page groups them by tier, in the
// tiers' order, and it and the home page show the featured sponsor's spotlight (backlog P-4).
//
// Sponsors are public, unlike pages, posts and events, so they're read directly rather than
// through the gated loaders in ./index.ts. Like the menus (sanity/site-chrome.ts), the answer is
// cached, one entry per day, perspective and choice of sponsors, and Sanity Live refreshes it when
// editors publish. If Sanity can't be reached, no sponsors show, and a retry follows within
// minutes.
import "server-only";
import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { defineQuery, stegaClean } from "next-sanity";
import { blockPhoto, type BlockPhoto } from "@/lib/pages/blocks";
import { safeHref } from "@/lib/site/navigation";
import { dateInSocietyTimeZone } from "@/lib/society-time";
import { isConfigured } from "../env";
import { getDynamicFetchOptions, sanityFetch, type DynamicFetchOptions } from "../live";
import { LOGO_PLACEMENTS, type OptionValue } from "../schemas/options";

/**
 * Sponsors whose sponsorship hasn't ended by $today (a date), all of them or those in $ids, by
 * tier (the Sponsors page's order) and then name, each with its tier.
 */
export const CURRENT_SPONSORS_QUERY = defineQuery(`*[_type == "sponsor"
  && (!defined(endsAt) || endsAt >= $today)
  && (count($ids) == 0 || _id in $ids)
] | order(coalesce(tier->sortOrder, 1000) asc, lower(name) asc) {
  _id, _updatedAt, name, website, logo{ asset, crop, hotspot, alt }, featured, blurb,
  tier->{ _id, name, logoPlacement, sortOrder, pricePerYear, benefits }
}`);

export type LogoPlacement = OptionValue<typeof LOGO_PLACEMENTS>;

/** A sponsor tier (board decisions §8: tiers are data, so the Studio can add more). */
export type SponsorTier = {
  id: string;
  /** The name to show, which keeps its edit markers in a preview. */
  name: string;
  /** How the tier's sponsors appear on the Sponsors page: a large logo, a logo, or the name only. */
  logoPlacement: LogoPlacement;
  /** Tiers with lower numbers come first. */
  sortOrder?: number;
  /** What the tier costs a year, in whole dollars. */
  pricePerYear?: number;
  /** What sponsors at this tier get, one line each, for display. */
  benefits: string[];
};

export type CurrentSponsor = {
  id: string;
  /** The name to show, which keeps its edit markers in a preview. */
  name: string;
  /** The sponsor's website, if it's a safe web address. */
  website?: string;
  /** The logo, with the editor's alt text or else the sponsor's name. */
  logo?: BlockPhoto;
  /** The sponsor's tier. The Studio requires one, but a sponsor may lack it, or name a deleted one. */
  tier?: SponsorTier;
  /** Turned on in the Studio: this sponsor's spotlight shows (see pickFeaturedSponsor). */
  featured?: boolean;
  /** The spotlight text, for display. */
  blurb?: string;
  /** When the sponsor last changed, which settles a tie between two featured sponsors. */
  updatedAt?: string;
};

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";

/** Text to show, which keeps its edit markers in a preview, or "" if there's none. */
const display = (value: unknown): string =>
  typeof value === "string" && plain(value) ? value : "";

const isLogoPlacement = (value: string): value is LogoPlacement =>
  LOGO_PLACEMENTS.some((placement) => placement.value === value);

/** A sponsor's tier, or undefined if the sponsor has none or it has no name. */
function parseTier(value: unknown): SponsorTier | undefined {
  const tier = fields(value);
  const id = plain(tier?._id);
  const name = display(tier?.name);
  if (!id || !name) return undefined;
  const placement = plain(tier?.logoPlacement);
  const sortOrder = tier?.sortOrder;
  const pricePerYear = tier?.pricePerYear;
  return {
    id,
    name,
    logoPlacement: isLogoPlacement(placement) ? placement : "logo",
    ...(typeof sortOrder === "number" && { sortOrder }),
    ...(typeof pricePerYear === "number" && pricePerYear >= 0 && { pricePerYear }),
    benefits: (Array.isArray(tier?.benefits) ? tier.benefits : []).map(display).filter(Boolean),
  };
}

/**
 * Turns the query result into the sponsors to show, skipping any without a name. Sponsors an
 * editor picked keep the editor's order.
 */
export function parseSponsors(data: unknown, ids: readonly string[]): CurrentSponsor[] {
  const sponsors = (Array.isArray(data) ? data : []).flatMap((item): CurrentSponsor[] => {
    const sponsor = fields(item);
    const id = plain(sponsor?._id);
    const name = display(sponsor?.name);
    if (!id || !name) return [];
    const website = safeHref(plain(sponsor?.website)) ?? undefined;
    const logo = blockPhoto(sponsor?.logo);
    const tier = parseTier(sponsor?.tier);
    const blurb = display(sponsor?.blurb);
    const updatedAt = plain(sponsor?._updatedAt);
    return [
      {
        id,
        name,
        website: website?.startsWith("http") ? website : undefined,
        logo: logo && { ...logo, alt: logo.alt || plain(name) },
        ...(tier && { tier }),
        ...(sponsor?.featured === true && { featured: true }),
        ...(blurb && { blurb }),
        ...(updatedAt && { updatedAt }),
      },
    ];
  });
  if (ids.length > 0) sponsors.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return sponsors;
}

const changedAt = (sponsor: CurrentSponsor) => Date.parse(sponsor.updatedAt ?? "") || 0;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The featured sponsor whose spotlight shows on the home page and the Sponsors page. The Studio
 * lets one sponsor be featured at a time, but two can still end up featured (see
 * OTHER_FEATURED_SPONSORS_QUERY in sanity/schemas/validation.ts). Then the one changed most
 * recently wins, so both pages show the same one. A sponsor past its last day isn't among
 * `sponsors`, so its spotlight goes with it.
 */
export function pickFeaturedSponsor(
  sponsors: readonly CurrentSponsor[],
): CurrentSponsor | undefined {
  return sponsors
    .filter((sponsor) => sponsor.featured)
    .sort((a, b) => changedAt(b) - changedAt(a) || byId(a, b))[0];
}

export type SponsorTierGroup = {
  /** The tier, or undefined for the sponsors that have none. */
  tier?: SponsorTier;
  /** Its current sponsors, by name. */
  sponsors: CurrentSponsor[];
};

const tierOrder = (tier: SponsorTier) => tier.sortOrder ?? 1000;
const tierName = (tier: SponsorTier) => plain(tier.name).toLowerCase();

/**
 * The Sponsors page's groups: one for each tier that has a current sponsor, in the tiers' order
 * (then by name), and the sponsors without a tier last.
 */
export function groupSponsorsByTier(sponsors: readonly CurrentSponsor[]): SponsorTierGroup[] {
  const groups = new Map<string, SponsorTierGroup>();
  for (const sponsor of sponsors) {
    const key = sponsor.tier?.id ?? "";
    const group = groups.get(key) ?? { tier: sponsor.tier, sponsors: [] };
    group.sponsors.push(sponsor);
    groups.set(key, group);
  }
  return [...groups.values()].sort(({ tier: a }, { tier: b }) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    return (
      tierOrder(a) - tierOrder(b) || tierName(a).localeCompare(tierName(b), "en") || byId(a, b)
    );
  });
}

/** The current sponsors for this perspective and day: see the top of this file. */
export async function getCurrentSponsors(
  ids: readonly string[],
  today: string,
  { perspective, stega }: DynamicFetchOptions,
): Promise<CurrentSponsor[]> {
  "use cache";
  if (!isConfigured) return [];
  try {
    const { data } = await sanityFetch({
      query: CURRENT_SPONSORS_QUERY,
      params: { ids: [...ids], today },
      perspective,
      stega,
    });
    return parseSponsors(data, ids);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading the sponsors from Sanity failed; showing none.", error);
    cacheLife("minutes");
    return [];
  }
}

/**
 * The current sponsors: the ones in `ids` (a "Sponsor logos" block's picks, as published document
 * ids), or every current sponsor if `ids` is empty, as the Sponsors page and the home page show
 * them. It reads the request (a preview shows drafts), so call it inside a <Suspense> boundary.
 */
export async function listCurrentSponsors(ids: readonly string[]): Promise<CurrentSponsor[]> {
  await connection();
  const today = dateInSocietyTimeZone(new Date()) ?? "";
  return getCurrentSponsors(ids, today, await getDynamicFetchOptions());
}
