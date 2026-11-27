// GROQ for pages, posts and events with their members-only parts gated (decision 0001, backlog
// M-7). Plain strings with no server code, so tests can run these queries with groq-js. The loaders
// in ./index.ts are the only callers; read content through them.
//
// Every query returns items of the same shape:
//   { _id, _type, _updatedAt, slug, visibility, <public fields>, locked, content }
// The public fields are fixed per type, below. `content` holds the fields the caller asks for.
// Sanity fills it in only when $memberLevel can see the item, so the item's members-only fields
// never leave Sanity for a viewer who can't see it; otherwise `content` is null and `locked` is
// true.
//
// That gate covers the item, not other documents the caller's GROQ reads, so:
// - content, filter and order are fixed strings in the code. Values go in params, never built from
//   request input.
// - No `*` outside quotes (checked below): a query of the whole dataset reads other documents
//   without their gates. Load other pages, posts and events, and the lists that fill a block, with
//   their own loader call.
// - No `documents::` functions (checked below): documents::get() follows a reference the way `->`
//   does.
// - A dereference (`->`) skips the target's gate. Venues, people and sponsors can be dereferenced
//   freely. From a page, post or event (link.internal), take only LINK_TARGET: _type,
//   "slug": slug.current and title. In content, each `->` needs a projection that lists the fields
//   it reads (checked below): no `...`, and no bare `@` or `^`, which stand for the whole other
//   document there. `@.slug.current` and `@{ title }` list fields, and an `@` in an array filter,
//   as in `tags[@ != "x"]`, is the element.
// - filter and order use public fields only: a filter on a members-only field answers questions
//   about it, and an order on one leaks its ranking.
//
// $memberLevel is the viewer's level while their membership is active, or null: visitors, people
// who never paid and members whose membership has ended (lib/members/access.ts activeLevel).

export const GATED_TYPES = ["page", "post", "event"] as const;
export type GatedType = (typeof GATED_TYPES)[number];

/**
 * What anyone may see of a page, post or event, even one they can't open, after the approved
 * concept (docs/design/prototype.html):
 * - page: its title, intro and template (the page header stays visible above the lock);
 * - post: headline, category, date and cover photo, but not the summary or the post;
 * - event: title, date and time, repeats, category, prices and photo, but not the venue or
 *   description.
 * Adding a field here makes it public on every locked item: check the concept first.
 */
export const PUBLIC_FIELDS: Record<GatedType, readonly string[]> = {
  page: ["title", "intro", "template"],
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
 * The fields to take from a page, post or event that a link points at (link.internal), as in
 * `{ body[]{ ..., markDefs[]{ ..., "target": internal->${LINK_TARGET} } } }`. A dereference skips
 * the target's gate, so this takes only what every locked item shows: its type, web address and
 * title. Load anything more with the target's own loader call.
 */
export const LINK_TARGET = '{ _type, "slug": slug.current, title }';

/** Where the string literal that opens at `start` ends (its closing quote), or -1 if it doesn't. */
function stringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === text[start]) return i;
  }
  return -1;
}

/**
 * Whitespace between GROQ tokens. The GROQ spec's list includes U+0085, which `\s` doesn't. Taking
 * more than GROQ does is safe here: the checks below then refuse more, never less.
 */
const SPACE = /[\s\x85]/;

/** The first character at or after `from` that isn't whitespace (text.length if none). */
function nextNonSpace(text: string, from: number): number {
  let i = from;
  while (i < text.length && SPACE.test(text[i])) i++;
  return i;
}

/** The last character before `before` that isn't whitespace (-1 if none). */
function previousNonSpace(text: string, before: number): number {
  let i = before - 1;
  while (i >= 0 && SPACE.test(text[i])) i--;
  return i;
}

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
      i = stringEnd(text, i);
      if (i < 0) return false;
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

/**
 * How `text`, which isBalancedGroq accepts, would read documents other than the gated item, or
 * null if it wouldn't. Outside string literals:
 * - "*": GROQ's every document (or a multiplication, which callers don't need). A query of other
 *   documents skips their gates.
 * - "documents::": GROQ's document functions. documents::get() resolves a (global) reference the
 *   way `->` does, skipping the target's gate.
 * - "->", in `content` only: a dereference not followed by a projection, or a projection that
 *   takes the whole other document instead of listing its fields: a `...` spread, or an `@` or `^`
 *   anywhere inside it that isn't picking fields (`@.slug.current`, `@{ title }`). In a
 *   dereference's projection `@` is the other document, and `^` is too from any scope nested in it
 *   (`body[]{ "doc": ^ }`). An `@` in an array filter, as in `tags[@ != "x"]`, is the element being
 *   tested, which only decides which elements are kept. What a dereference reads of the other
 *   document must be listed, so a reviewer can check it's public.
 */
export function readsOtherDocuments(
  text: string,
  content: boolean,
): "*" | "documents::" | "->" | null {
  // Each open bracket, whether it's a dereference's projection, and whether a `[` is an array
  // filter (it follows a value) rather than an array (`[@]`).
  const open: { bracket: string; dereference: boolean; filter: boolean }[] = [];
  let projectionAt = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === "'") {
      i = stringEnd(text, i);
      if (i < 0) return null;
    } else if (char === "*") {
      return "*";
    } else if (/[A-Za-z_]/.test(char)) {
      // A name: a field, a keyword, or a function or its namespace. Spaces may come before `::`.
      let end = i + 1;
      while (/\w/.test(text[end] ?? "")) end++;
      const name = text.slice(i, end);
      if (/^documents$/i.test(name) && text.startsWith("::", nextNonSpace(text, end))) {
        return "documents::";
      }
      i = end - 1;
    } else if (!content) {
      continue;
    } else if (char === "{" || char === "[" || char === "(") {
      const before = text[previousNonSpace(text, i)] ?? "";
      open.push({
        bracket: char,
        dereference: i === projectionAt,
        filter: char === "[" && /[\w)\]}"'@^]/.test(before),
      });
    } else if (char === "}" || char === "]" || char === ")") {
      open.pop();
    } else if (char === "-" && text[i + 1] === ">") {
      const next = nextNonSpace(text, i + 2);
      if (text[next] !== "{") return "->";
      projectionAt = next;
      i = next - 1;
    } else if (text.startsWith("...", i)) {
      // A spread, not a slice like [0...3]: it reads every field.
      if (open.at(-1)?.bracket === "{" && open.some((each) => each.dereference)) return "->";
      i += 2;
    } else if ((char === "@" || char === "^") && open.some((each) => each.dereference)) {
      // Picking fields: `.` and a name, or a projection. (In `^.^` the second `^` is checked
      // itself.) Not `@[...]`: by the GROQ spec a filter returns a value that isn't an array as it
      // is, so `@[true]` is the whole document.
      const next = nextNonSpace(text, i + 1);
      const picksFields = text[next] === "{" || text[next] === ".";
      const element = char === "@" && open.at(-1)?.filter === true;
      if (!picksFields && !element) return "->";
    }
  }
  return null;
}

/** Where callers' GROQ goes in a gated query, as error messages name it. */
const PARTS = {
  content: "The members-only fields",
  filter: "The list filter",
  order: "The list order",
};

/** Throws unless the caller's GROQ can go in that part of a gated query. */
function checkCallerGroq(part: keyof typeof PARTS, text: string): void {
  const name = PARTS[part];
  const content = part === "content";
  if (!isBalancedGroq(text, content)) {
    throw new Error(
      content
        ? `${name} must be one GROQ projection in braces, not: ${text}`
        : `${name} must be one balanced GROQ expression, not: ${text}`,
    );
  }
  const read = readsOtherDocuments(text, content);
  if (read === "*") {
    throw new Error(
      `${name} can't use * outside quotes: a query of other documents skips their members-only rules. Load other pages, posts and events with their own getGatedItem or listGatedItems call. Not: ${text}`,
    );
  }
  if (read === "documents::") {
    throw new Error(
      `${name} can't use documents:: functions: documents::get() reads another document past its members-only rules, as -> does. Load other pages, posts and events with their own getGatedItem or listGatedItems call. Not: ${text}`,
    );
  }
  if (read === "->") {
    throw new Error(
      `${name} must follow each -> with a projection that lists the fields it reads, without ... or a bare @ or ^ (write @.slug.current, not @), such as venue->{ name, address } or internal->${LINK_TARGET}. Not: ${text}`,
    );
  }
}

function checkType(type: string): void {
  if (!(GATED_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Not a gated document type: ${type}`);
  }
}

/**
 * The projection for one gated item. `content` is a GROQ projection, such as
 * `{ excerpt, body }`, of the fields only viewers who can see the item get. It may not query other
 * documents (`*`, `documents::`), and each dereference (`->`) needs a projection listing what it
 * reads: see the rules at the top of this file.
 */
export function gatedProjection(type: GatedType, content: string): string {
  checkType(type);
  const fields = content.trim();
  checkCallerGroq("content", fields);
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
   * fields: a condition on a members-only field would tell visitors something about it. No `*` or
   * `documents::` outside quotes.
   */
  filter?: string;
  /**
   * A GROQ ordering, such as `publishedAt desc`. Public fields only: an order on a members-only
   * field leaks its ranking. No `*` or `documents::` outside quotes.
   */
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
  if (filter !== undefined) checkCallerGroq("filter", filter);
  if (order !== undefined) checkCallerGroq("order", order);
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
