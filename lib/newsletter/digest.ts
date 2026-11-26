// The monthly email digest (backlog E-4): the month's blog posts marked "Include in the monthly
// email digest", for the newsletter (emails/monthly-newsletter.tsx) that the Monthly digest screen
// (app/admin/digest) gives the newsletter writer to paste into MailerLite.
import "server-only";
import type { DigestPost } from "@/emails/monthly-newsletter";
import { getRoles } from "@/lib/auth/user";
import { monthRange } from "@/lib/society-time";
import { listPublicItems, type GatedItem } from "@/sanity/content";
import { POST_CATEGORIES, optionTitle } from "@/sanity/schemas/options";

/** What the digest shows of a post besides its public fields: the summary, if everyone may read it. */
export const DIGEST_CONTENT = "{ excerpt }";

/**
 * The posts marked for the digest that were published in the month on the Society's calendar,
 * up to now (a scheduled post waits for its date). $now also makes each digest a query of its
 * own, so it's never an answer cached before the latest post was published. includeInDigest isn't
 * members-only content: it's the editors' choice of what goes in an email to everyone, which shows
 * a members-only post by its public fields only.
 */
export const DIGEST_FILTER =
  "includeInDigest == true && dateTime(publishedAt) >= dateTime($start) && dateTime(publishedAt) < dateTime($end) && dateTime(publishedAt) <= dateTime($now)";

/** Latest first, like the blog. */
export const DIGEST_ORDER = "publishedAt desc";

/** The values DIGEST_FILTER needs for `month` (written "2026-11") at `now`. */
export function digestParams(month: string, now: Date) {
  const { start, end } = monthRange(month);
  return { start: start.toISOString(), end: end.toISOString(), now: now.toISOString() };
}

/**
 * The month's digest posts, latest first. They're read as a visitor sees them, published only
 * (listPublicItems), so a members-only post comes without its summary whoever asks: the newsletter
 * also reaches people who aren't members.
 */
export async function loadDigestPosts(month: string, now: Date): Promise<DigestPost[]> {
  const posts = await listPublicItems<"post", { excerpt?: unknown }>("post", DIGEST_CONTENT, {
    filter: DIGEST_FILTER,
    order: DIGEST_ORDER,
    params: digestParams(month, now),
  });
  return posts.flatMap(toDigestPost);
}

function toDigestPost(post: GatedItem<"post", { excerpt?: unknown }>): DigestPost[] {
  const title = typeof post.title === "string" ? post.title.trim() : "";
  if (!title || typeof post.publishedAt !== "string") return [];
  const membersOnly = !post.access.allowed;
  const excerpt = membersOnly ? null : post.content?.excerpt;
  return [
    {
      title,
      slug: post.slug,
      category: optionTitle(POST_CATEGORIES, post.category),
      publishedAt: post.publishedAt,
      membersOnly,
      summary: typeof excerpt === "string" && excerpt.trim() ? excerpt.trim() : null,
    },
  ];
}

/**
 * Whether the signed-in member `userId` makes the digest: editors and administrators. A UI check:
 * the digest holds only what anyone may read.
 */
export async function makesDigest(userId: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes("editor") || roles.includes("admin");
}
