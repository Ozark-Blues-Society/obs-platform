// GROQ for pages, posts and events with their members-only parts gated (decision 0001, backlog
// M-7). Plain strings with no server code, so tests can run these queries with groq-js. The loaders
// in ./index.ts are the only callers; read content through them.
//
// Every query returns items of the same shape:
//   { _id, _type, _updatedAt, slug, visibility, <public fields>, locked, content }
// The public fields are fixed per type, below. `content` holds the fields the caller asks for.
// Sanity fills it in only when $memberLevel can see the item, so a members-only body never leaves
// Sanity for a viewer who can't see it; otherwise `content` is null and `locked` is true.
//
// $memberLevel is the viewer's level while their membership is active, or null: visitors, people
// who never paid and members whose membership has ended (lib/members/access.ts activeLevel).

export const GATED_TYPES = ["page", "post", "event"] as const;
export type GatedType = (typeof GATED_TYPES)[number];

/**
 * What anyone may see of a page, post or event, even one they can't open, after the approved
 * concept (docs/design/prototype.html):
 * - page: its title and template (the page header stays visible above the lock);
 * - post: headline, category, date and cover photo, but not the summary or the post;
 * - event: title, date and time, repeats, category, prices and photo, but not the venue or
 *   description.
 * Adding a field here makes it public on every locked item: check the concept first.
 */
export const PUBLIC_FIELDS: Record<GatedType, readonly string[]> = {
  page: ["title", "template"],
  post: ["title", "category", "publishedAt", "coverImage"],
  event: ["title", "start", "recurrence", "category", "priceText", "memberPrice", "image"],
};

/** True when $memberLevel can see the item: the same rule as checkAccess in lib/members/access.ts. */
export const CAN_VIEW =
  '(visibility.audience == "everyone" || ($memberLevel != null && (visibility.audience == "members" || (visibility.audience == "levels" && $memberLevel in coalesce(visibility.levels, [])))))';

/** Fields every gated item has, besides its type's public fields. */
const COMMON_FIELDS =
  '_id, _type, _updatedAt, "slug": slug.current, visibility{ audience, levels }';

/**
 * Whether `text` is one balanced GROQ expression: every bracket closes in order, outside string
 * literals, and with no comments, which could hide one. With `wrapped`, the whole text is a single
 * `{ ... }` whose outer brace closes only at the end. The loaders paste callers' GROQ into the
 * query, so this keeps each piece inside its place: a members-only field can't slip out of
 * `content`, and a filter can't escape its parentheses.
 */
export function isBalancedGroq(text: string, wrapped = false): boolean {
  if (wrapped && !(text.startsWith("{") && text.endsWith("}"))) return false;
  const closers: string[] = [];
  const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")" };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === "'") {
      for (i++; i < text.length && text[i] !== char; i++) {
        if (text[i] === "\\") i++;
      }
      if (i >= text.length) return false;
    } else if (char === "/" && text[i + 1] === "/") {
      return false;
    } else if (char in pairs) {
      closers.push(pairs[char]);
    } else if (char === "}" || char === "]" || char === ")") {
      if (closers.pop() !== char) return false;
      if (wrapped && closers.length === 0 && i !== text.length - 1) return false;
    }
  }
  return closers.length === 0;
}

function checkType(type: string): void {
  if (!(GATED_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Not a gated document type: ${type}`);
  }
}

/**
 * The projection for one gated item. `content` is a GROQ projection, such as
 * `{ excerpt, body }`, of the fields only viewers who can see the item get.
 */
export function gatedProjection(type: GatedType, content: string): string {
  checkType(type);
  const fields = content.trim();
  if (!isBalancedGroq(fields, true)) {
    throw new Error(
      `The members-only fields must be one GROQ projection in braces, not: ${content}`,
    );
  }
  return `{ ${COMMON_FIELDS}, ${PUBLIC_FIELDS[type].join(", ")}, "locked": !${CAN_VIEW}, "content": select(${CAN_VIEW} => @${fields}) }`;
}

/** One page, post or event by its web address: params $slug and $memberLevel. */
export function itemQuery(type: GatedType, content: string): string {
  const projection = gatedProjection(type, content);
  return `*[_type == "${type}" && slug.current == $slug][0]${projection}`;
}

export type ListOptions = {
  /**
   * A GROQ condition the items must also meet, such as `category == $category`. Use only public
   * fields: a condition on a members-only field would tell visitors something about it.
   */
  filter?: string;
  /** A GROQ ordering, such as `publishedAt desc`. */
  order?: string;
  /** At most this many items. */
  limit?: number;
};

/** Pages, posts or events: param $memberLevel, plus any the filter uses. */
export function listQuery(type: GatedType, content: string, options: ListOptions = {}): string {
  const projection = gatedProjection(type, content);
  const filter = options.filter?.trim() || undefined;
  const order = options.order?.trim() || undefined;
  const { limit } = options;
  for (const [name, text] of [
    ["filter", filter],
    ["order", order],
  ] as const) {
    if (text !== undefined && !isBalancedGroq(text)) {
      throw new Error(`The list ${name} must be one balanced GROQ expression, not: ${text}`);
    }
  }
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
    throw new Error(`The list limit must be a whole number above 0, not: ${limit}`);
  }
  return [
    `*[_type == "${type}" && defined(slug.current)${filter ? ` && (${filter})` : ""}]`,
    order ? ` | order(${order})` : "",
    limit !== undefined ? `[0...${limit}]` : "",
    projection,
  ].join("");
}
