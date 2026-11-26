// The one way the site reads pages, posts and events from Sanity (decision 0001, backlog M-7).
// Each loader works out who is viewing first, then asks Sanity for the item with its members-only
// fields filled in only if that viewer can see it (./gated-query.ts), then checks again here. So an
// item's members-only fields are fetched and rendered only after the access check, whichever page,
// feed or metadata route asks for it. The check covers that item, so callers' GROQ must not read
// other documents past their own gates (the rules at the top of ./gated-query.ts). ESLint stops
// other code from using the Sanity client directly (eslint.config.mjs).
//
// Loaders run at request time and read the session, so call them inside a <Suspense> boundary.
// Results are cached per query, viewer level and preview mode, never per person: two members at
// the same level share an entry, and a visitor never gets a member's.
import "server-only";
import { stegaClean } from "next-sanity";
import { connection } from "next/server";
import {
  activeLevel,
  checkAccess,
  type Access,
  type Viewer,
  type Visibility,
} from "@/lib/members/access";
import { getViewer } from "@/lib/members/viewer";
import { isConfigured } from "../env";
import { getDynamicFetchOptions, sanityFetch, type DynamicFetchOptions } from "../live";
import { itemQuery, listQuery, type GatedType, type ListOptions } from "./gated-query";

export { LINK_TARGET } from "./gated-query";
export type { GatedType, ListOptions } from "./gated-query";

/** The public fields of each type (PUBLIC_FIELDS in ./gated-query.ts), as Sanity stores them. */
type PublicFields = {
  page: { title?: string; template?: string };
  post: { title?: string; category?: string; publishedAt?: string; coverImage?: unknown };
  event: {
    title?: string;
    start?: string;
    recurrence?: unknown;
    category?: string;
    priceText?: string;
    memberPrice?: string;
    image?: unknown;
  };
};

export type GatedItem<T extends GatedType, Content> = PublicFields[T] & {
  _id: string;
  _type: T;
  _updatedAt?: string;
  /** The web address's last part (sanity/paths.ts), without edit markers. */
  slug: string;
  /** Who can see it, without edit markers. */
  visibility: Visibility;
  /** Whether the viewer can see it, and if not, why: what the lock should say. */
  access: Access;
  /** The members-only fields the caller asked for. Null unless access.allowed. */
  content: Content | null;
};

/**
 * One page, post or event by its web address, or null if there's none (or no Sanity project yet).
 * `content` is a GROQ projection of the fields only viewers who can see it get, such as
 * `{ excerpt, body }`. Every other field is public: PUBLIC_FIELDS in ./gated-query.ts.
 *
 * The gate covers this item only. So `content` is a fixed string in the code, and:
 * - No `*` or `documents::` outside quotes (refused). Load other pages, posts and events, and the
 *   lists that fill a block, with their own loader call.
 * - A dereference (`->`) skips the target's gate. Venues, people and sponsors can be dereferenced
 *   freely. From a page, post or event (link.internal), take only LINK_TARGET: _type,
 *   "slug": slug.current and title. Each `->` needs a projection listing the fields it reads,
 *   without `...` or a bare `@` or `^` (refused; `@.slug.current` lists a field).
 */
export async function getGatedItem<T extends GatedType, Content = Record<string, unknown>>(
  type: T,
  slug: string,
  content: string,
): Promise<GatedItem<T, Content> | null> {
  const query = itemQuery(type, content);
  if (!isConfigured) return null;
  const viewing = await whoIsViewing();
  const raw = await fetchForLevel(query, { slug, memberLevel: viewing.memberLevel }, viewing);
  return raw === null ? null : gate<T, Content>(raw, type, viewing);
}

/**
 * Pages, posts or events (none without a Sanity project), locked ones without their members-only
 * fields. `content` is as for getGatedItem, with the same rules: no `*` or `documents::`, and from
 * a page, post or event a dereference takes only LINK_TARGET. `params` are values the filter uses,
 * such as `{ category: "jam" }`.
 *
 * `filter` and `order` are fixed strings in the code too, with no `*` or `documents::` outside
 * quotes. Values go in `params`, never built from request input. Use public fields only: a filter
 * on a members-only field answers questions about it, and an order on one leaks its ranking.
 */
export async function listGatedItems<T extends GatedType, Content = Record<string, unknown>>(
  type: T,
  content: string,
  options: ListOptions & { params?: Record<string, unknown> } = {},
): Promise<GatedItem<T, Content>[]> {
  const { params, ...list } = options;
  const query = listQuery(type, content, list);
  if (!isConfigured) return [];
  const viewing = await whoIsViewing();
  // The viewer's level goes last, so no caller can choose it.
  const raw = await fetchForLevel(query, { ...params, memberLevel: viewing.memberLevel }, viewing);
  return Array.isArray(raw)
    ? raw.flatMap((item: unknown) => {
        const gated = gate<T, Content>(item, type, viewing);
        return gated ? [gated] : [];
      })
    : [];
}

type Viewing = DynamicFetchOptions & {
  viewer: Viewer;
  now: Date;
  /** The viewer's level while their membership is active, otherwise null. */
  memberLevel: string | null;
};

async function whoIsViewing(): Promise<Viewing> {
  // At request time only: a members-only item never ends up in a prerendered page.
  await connection();
  const [viewer, options] = await Promise.all([getViewer(), getDynamicFetchOptions()]);
  const now = new Date();
  return { ...options, viewer, now, memberLevel: activeLevel(viewer, now) };
}

// Not exported, so nothing can ask for another level's content: the loaders above work out
// memberLevel from the session themselves. Its arguments are the cache key, so each viewer level
// gets its own entry. Sanity Live refreshes the entries when editors publish.
async function fetchForLevel(
  query: string,
  params: Record<string, unknown> & { memberLevel: string | null },
  { perspective, stega }: DynamicFetchOptions,
): Promise<unknown> {
  "use cache";
  const { data } = await sanityFetch({ query, params, perspective, stega });
  return data;
}

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const clean = (value: unknown): string | null =>
  typeof value === "string" ? stegaClean(value).trim() : null;

/**
 * Checks Sanity's answer for one item against the viewer: content only if checkAccess allows it
 * too. In a preview, text carries invisible edit markers, so the values the check reads are
 * cleaned first.
 */
function gate<T extends GatedType, Content>(
  raw: unknown,
  type: T,
  { viewer, now }: Viewing,
): GatedItem<T, Content> | null {
  if (!isFields(raw) || raw._type !== type || typeof raw._id !== "string") return null;
  // The query's own fields; the rest are the type's public fields.
  const { locked, content, slug: rawSlug, visibility: rawVisibility, ...publicFields } = raw;
  const slug = clean(rawSlug);
  if (!slug) return null;

  const fields = isFields(rawVisibility) ? rawVisibility : {};
  const levels = Array.isArray(fields.levels) ? fields.levels.map(clean) : [];
  const visibility: Visibility = {
    audience: clean(fields.audience),
    levels: levels.filter((level): level is string => level !== null),
  };

  let access = checkAccess(visibility, viewer, now);
  const sanityAllowed = locked === false;
  if (access.allowed !== sanityAllowed) {
    // The query and checkAccess apply the same rule, so this is a bug: show nothing.
    console.error(
      `sanity/content: Sanity and checkAccess disagree about ${raw._id} (Sanity says ${sanityAllowed ? "open" : "locked"}); showing it locked.`,
    );
    if (access.allowed) access = { allowed: false, reason: "level" };
  }

  // The public fields are Sanity's values as stored: typed, not checked.
  return {
    ...publicFields,
    _id: raw._id,
    _type: type,
    slug,
    visibility,
    access,
    content: access.allowed && isFields(content) ? (content as Content) : null,
  } as GatedItem<T, Content>;
}
