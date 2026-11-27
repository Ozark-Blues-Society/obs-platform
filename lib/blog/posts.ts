// Blog posts as the blog and the post page show them (backlog P-3): the members-only fields they
// ask sanity/content's loaders for, which posts are out yet, the category filter and the pages of
// the list. No server code, so tests can run it.
import { stegaClean, type PortableTextBlock } from "next-sanity";
import type { MemberFileLink } from "@/components/members/member-files";
import { blockPhoto, type BlockPhoto } from "@/lib/pages/blocks";
import type { GatedItem } from "@/sanity/content";
import { BLOG_PATH } from "@/sanity/paths";
import { POST_CATEGORIES, optionTitle, type OptionValue } from "@/sanity/schemas/options";

export type PostCategory = OptionValue<typeof POST_CATEGORIES>;

/** Posts on each page of the blog, latest first: three rows of four on a computer. */
export const POSTS_PER_PAGE = 12;

/** What a blog card shows of a post besides its public fields: the summary, if the viewer may read it. */
export const POST_LIST_CONTENT = "{ excerpt }";

/** Latest first. The id settles ties, so a post never moves between pages from one visit to the next. */
export const POST_LIST_ORDER = "publishedAt desc, _id asc";

/**
 * A post's members-only fields, for the post page: the summary, the post, its author and its
 * files. People can be dereferenced freely (sanity/content's rules), so the author comes along,
 * listing the fields the page shows.
 */
export const POST_CONTENT =
  "{ excerpt, body, author->{ name, role, bio, photo }, memberFiles[]{ title, fileId } }";

/** What listGatedItems returns in `content` for POST_LIST_CONTENT. */
export type PostListContent = { excerpt?: unknown };
/** What getGatedItem returns in `content` for POST_CONTENT. */
export type PostContent = {
  excerpt?: unknown;
  body?: unknown;
  author?: unknown;
  memberFiles?: MemberFileLink[];
};

export type PostListItem = GatedItem<"post", PostListContent>;
export type PostItem = GatedItem<"post", PostContent>;

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;

// In a preview, strings carry invisible edit markers (stega) that let editors click text to edit
// it. Text people read keeps them; values the site acts on (dates, choices) are cleaned.
const text = (value: unknown): string | undefined =>
  typeof value === "string" && stegaClean(value).trim() !== "" ? value : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";

/** When a post goes out: its publish date in milliseconds, or null if it has none that reads. */
export function publishTime(publishedAt: unknown): number | null {
  const time = Date.parse(plain(publishedAt));
  return Number.isFinite(time) ? time : null;
}

/** Whether a post is out by `now`. A later publish date schedules it: hidden until then. */
export function isPublished(publishedAt: unknown, now: Date): boolean {
  const time = publishTime(publishedAt);
  return time !== null && time <= now.getTime();
}

/** The first value of a search parameter that appears more than once. */
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The category `?category=` picks, or null for every post (none given, or no such category). */
export function blogCategory(value: string | string[] | undefined): PostCategory | null {
  const wanted = first(value);
  return POST_CATEGORIES.find((option) => option.value === wanted)?.value ?? null;
}

/** The page `?page=` asks for: a whole number from 1, or 1 for anything else. */
export function blogPageNumber(value: string | string[] | undefined): number {
  const wanted = first(value);
  return wanted && /^[1-9]\d{0,5}$/.test(wanted) ? Number(wanted) : 1;
}

/** The blog's web address for a category (null for all of them) and a page of it. */
export function blogHref(category: PostCategory | null, page = 1): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${BLOG_PATH}?${query}` : BLOG_PATH;
}

/** The tab title for a category and page of the blog, so screen readers hear which one opened. */
export function blogTitle(category: PostCategory | null, page: number): string {
  const name = category && optionTitle(POST_CATEGORIES, category);
  const which = [name, page > 1 ? `page ${page}` : ""].filter(Boolean).join(", ");
  const label = which.charAt(0).toUpperCase() + which.slice(1);
  return [label, "Blog", "Ozark Blues Society"].filter(Boolean).join(" · ");
}

export type BlogPage<T> = {
  /** This page's posts, latest first. */
  posts: T[];
  /** How many posts all the pages hold together. */
  total: number;
  /** Which page this is, from 1. */
  page: number;
  /** How many pages there are: at least 1, even with no posts. */
  pageCount: number;
};

/**
 * One page of the blog, from the posts sanity/content listed (latest first): the posts that are
 * out by `now`, in `category` if one is picked, POSTS_PER_PAGE to a page. A preview shows the
 * scheduled ones too, so editors can see a post before it goes out. A page past the last shows
 * the last.
 */
export function selectBlogPage<T extends { category?: unknown; publishedAt?: unknown }>(
  posts: readonly T[],
  options: { category: PostCategory | null; page: number; now: Date; preview: boolean },
): BlogPage<T> {
  const { category, now, preview } = options;
  const shown = posts.filter(
    (post) =>
      (preview ? publishTime(post.publishedAt) !== null : isPublished(post.publishedAt, now)) &&
      (category === null || plain(post.category) === category),
  );
  const pageCount = Math.max(1, Math.ceil(shown.length / POSTS_PER_PAGE));
  const page = Math.min(Math.max(1, options.page), pageCount);
  return {
    posts: shown.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE),
    total: shown.length,
    page,
    pageCount,
  };
}

/** A post's category, as its stored value (null if it has none this code knows) and its title. */
export function postCategory(value: unknown): { value: PostCategory | null; title: string } {
  const stored = plain(value);
  const known = POST_CATEGORIES.find((option) => option.value === stored)?.value ?? null;
  return { value: known, title: optionTitle(POST_CATEGORIES, stored) };
}

/** A post's headline, keeping a preview's edit markers. */
export function postTitle(value: unknown): string {
  return text(value) ?? "Untitled post";
}

/** A post's summary, if the viewer may read it (`content` is null otherwise) and it has one. */
export function postExcerpt(content: { excerpt?: unknown } | null): string | undefined {
  return text(content?.excerpt);
}

/** The cover photo, if the post has one. */
export function postCover(value: unknown): BlockPhoto | undefined {
  return blockPhoto(value);
}

/** The post's text: its blocks, without anything that isn't one. */
export function postBody(value: unknown): PortableTextBlock[] {
  return Array.isArray(value)
    ? value.filter((item): item is PortableTextBlock => fields(item) !== undefined)
    : [];
}

export type PostAuthor = { name: string; role?: string; bio?: string; photo?: BlockPhoto };

/** Who wrote the post (a person or a team from People), if the post names someone. */
export function postAuthor(value: unknown): PostAuthor | undefined {
  const author = fields(value);
  const name = text(author?.name);
  if (!name) return undefined;
  return {
    name,
    role: text(author?.role),
    bio: text(author?.bio),
    photo: blockPhoto(author?.photo),
  };
}
