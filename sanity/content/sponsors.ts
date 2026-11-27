// The sponsors a page's "Sponsor logos" block shows (backlog C-2): every current sponsor, or the
// ones an editor picked for that block, never one past its last day. A sponsorship's endsAt is a
// date in Central Time, and the sponsor disappears the day after it.
//
// Sponsors are public, unlike pages, posts and events, so they're read directly rather than
// through the gated loaders in ./index.ts. Like the menus (sanity/site-chrome.ts), the answer is
// cached, one entry per day, perspective and choice of sponsors, and Sanity Live refreshes it when
// editors publish. If Sanity can't be reached, the block shows nothing and a retry follows within
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

/**
 * Sponsors whose sponsorship hasn't ended by $today (a date), all of them or those in $ids, by
 * tier (the Sponsors page's order) and then name.
 */
export const CURRENT_SPONSORS_QUERY = defineQuery(`*[_type == "sponsor"
  && (!defined(endsAt) || endsAt >= $today)
  && (count($ids) == 0 || _id in $ids)
] | order(coalesce(tier->sortOrder, 1000) asc, lower(name) asc) {
  _id, name, website, logo{ asset, crop, hotspot, alt }
}`);

export type CurrentSponsor = {
  id: string;
  /** The name to show, which keeps its edit markers in a preview. */
  name: string;
  /** The sponsor's website, if it's a safe web address. */
  website?: string;
  /** The logo, with the editor's alt text or else the sponsor's name. */
  logo?: BlockPhoto;
};

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";

/**
 * Turns the query result into the sponsors to show, skipping any without a name. Sponsors an
 * editor picked keep the editor's order.
 */
export function parseSponsors(data: unknown, ids: readonly string[]): CurrentSponsor[] {
  const sponsors = (Array.isArray(data) ? data : []).flatMap((item): CurrentSponsor[] => {
    const sponsor = fields(item);
    const id = plain(sponsor?._id);
    const name = typeof sponsor?.name === "string" ? sponsor.name : "";
    if (!id || !plain(name)) return [];
    const website = safeHref(plain(sponsor?.website)) ?? undefined;
    const logo = blockPhoto(sponsor?.logo);
    return [
      {
        id,
        name,
        website: website?.startsWith("http") ? website : undefined,
        logo: logo && { ...logo, alt: logo.alt || plain(name) },
      },
    ];
  });
  if (ids.length > 0) sponsors.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return sponsors;
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
 * The sponsors a "Sponsor logos" block shows: the ones in `ids` (an editor's picks, as published
 * document ids), or every current sponsor if `ids` is empty. It reads the request (a preview shows
 * drafts), so call it inside a <Suspense> boundary.
 */
export async function listCurrentSponsors(ids: readonly string[]): Promise<CurrentSponsor[]> {
  await connection();
  const today = dateInSocietyTimeZone(new Date()) ?? "";
  return getCurrentSponsors(ids, today, await getDynamicFetchOptions());
}
