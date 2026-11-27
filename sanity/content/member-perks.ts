// Member perks on My Account (backlog M-8, board-decisions §1 and §5): the benefits of the member's
// level and the perk codes for it, from Site settings. The codes are members-only
// (board-decisions §6). Like the rest of the members-only content, they sit in the private dataset
// and are read here, on the server, with the read token (decision 0001), and only for a member
// whose membership is active.
//
// Who gets what is decided twice, as for the venue directory: the query returns nothing unless
// $memberLevel is an active member's level, and keeps only that level's rows. Then this module
// checks each row's levels again. A request from someone without an active membership doesn't
// reach Sanity at all.
//
// Read perkCodes only here. The other queries of Site settings list the fields they read (the menus
// and footer, sanity/site-chrome.ts), so none of them sends a code anywhere.
import "server-only";
import { unstable_rethrow } from "next/navigation";
import { stegaClean } from "next-sanity";
import { connection } from "next/server";
import { activeLevel } from "@/lib/members/access";
import { getViewer } from "@/lib/members/viewer";
import type { MembershipLevel } from "@/sanity/schemas/options";
import { isConfigured } from "../env";
import { getDynamicFetchOptions, sanityFetch, type DynamicFetchOptions } from "../live";

/**
 * Site settings' benefits and perk codes for an active member at $memberLevel: null for a null
 * level. No server code, so tests run it with groq-js.
 */
export const MEMBER_PERKS_QUERY = `*[_id == "siteSettings" && $memberLevel != null][0]{
  "benefits": membershipBenefits[$memberLevel in levels]{ _key, benefit, levels },
  "perkCodes": perkCodes[$memberLevel in levels]{ _key, label, code, details, levels }
}`;

/** A benefit of the member's level: a row of the benefits table. */
export type Benefit = { key: string; text: string };

/** A code the member uses for a perk. */
export type PerkCode = {
  key: string;
  /** What it is: "Member discount code". */
  label: string;
  /** The code itself, without a preview's edit markers, since members copy it. */
  code: string;
  /** Where and how to use it. */
  details?: string;
};

export type MemberPerks = {
  /** The member's level while their membership is active; otherwise null, with no perks. */
  level: MembershipLevel | null;
  benefits: Benefit[];
  perkCodes: PerkCode[];
  /** Sanity couldn't be reached: the perks may exist but couldn't be loaded. */
  unavailable?: true;
};

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const list = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.flatMap((item: unknown): Fields[] => {
        const found = fields(item);
        return found ? [found] : [];
      })
    : [];
// Text people read keeps a preview's invisible edit markers, so it isn't trimmed: trim() would also
// cut the markers' characters.
const text = (value: unknown): string | undefined =>
  typeof value === "string" && stegaClean(value).trim() !== "" ? value : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";
const forLevel = (row: Fields, level: MembershipLevel) =>
  Array.isArray(row.levels) && row.levels.some((each) => plain(each) === level);

/**
 * Turns the query's answer into the perks of `level`, in the editors' order, skipping incomplete
 * rows and any row that isn't for this level, whatever Sanity sent.
 */
export function parseMemberPerks(
  data: unknown,
  level: MembershipLevel,
): Pick<MemberPerks, "benefits" | "perkCodes"> {
  const result = fields(data);
  const benefits = list(result?.benefits).flatMap((row): Benefit[] => {
    const key = plain(row._key);
    const benefit = text(row.benefit);
    return key && benefit && forLevel(row, level) ? [{ key, text: benefit }] : [];
  });
  const perkCodes = list(result?.perkCodes).flatMap((row): PerkCode[] => {
    const key = plain(row._key);
    const label = text(row.label);
    const code = plain(row.code);
    const details = text(row.details);
    if (!key || !label || !code || !forLevel(row, level)) return [];
    return [{ key, label, code, ...(details && { details }) }];
  });
  return { benefits, perkCodes };
}

/**
 * The signed-in member's perks: none without an active membership. If Sanity can't be reached, no
 * perks and `unavailable`, so the rest of My Account still shows. It reads the session, so call it
 * inside a <Suspense> boundary.
 */
export async function getMemberPerks(): Promise<MemberPerks> {
  // At request time only: perk codes never end up in a prerendered page.
  await connection();
  const level = activeLevel(await getViewer(), new Date());
  if (level === null || !isConfigured) return { level, benefits: [], perkCodes: [] };
  try {
    const data = await fetchForLevel(level, await getDynamicFetchOptions());
    return { level, ...parseMemberPerks(data, level) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading the member perks from Sanity failed.", error);
    return { level, benefits: [], perkCodes: [], unavailable: true };
  }
}

// Not exported, so nothing can ask for another level's perks: getMemberPerks works out the level
// from the session. Its arguments are the cache key, so each level gets its own entry, never a
// person. Sanity Live refreshes the entries when editors publish.
async function fetchForLevel(
  memberLevel: MembershipLevel,
  { perspective, stega }: DynamicFetchOptions,
): Promise<unknown> {
  "use cache";
  const { data } = await sanityFetch({
    query: MEMBER_PERKS_QUERY,
    params: { memberLevel },
    perspective,
    stega,
  });
  return data;
}
