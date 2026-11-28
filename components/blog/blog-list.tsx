import Link from "next/link";
import type { ReactNode } from "react";
import { SanityImage } from "@/components/blocks/sanity-image";
import { CardGrid } from "@/components/ui/card-grid";
import { PillLinks } from "@/components/ui/pill-links";
import { PlaceholderPhoto, type PlaceholderPhotoTone } from "@/components/ui/placeholder-photo";
import { PostCard } from "@/components/ui/post-card";
import {
  blogHref,
  postCategory,
  postCover,
  postExcerpt,
  postTitle,
  publishTime,
  type BlogPage,
  type PostCategory,
  type PostListItem,
} from "@/lib/blog/posts";
import { postPath } from "@/sanity/paths";
import { POST_CATEGORIES, optionTitle } from "@/sanity/schemas/options";

/** The drawn stage scene a post without a cover photo gets, by category, as in the concept. */
const PLACEHOLDER_TONES: Record<PostCategory, PlaceholderPhotoTone> = {
  recap: "night",
  "band-spotlight": "rust",
  "society-news": "brass",
  education: "green",
};

type BlogListProps = BlogPage<PostListItem> & {
  /** The category picked, or null for every post. */
  category: PostCategory | null;
  /** Shown after the posts and the page links: the newsletter signup box. */
  children?: ReactNode;
};

/**
 * One page of the blog (backlog P-3): the category pills, the posts' cards and links to the other
 * pages. Each filter and page has its own web address (lib/blog/posts.ts blogHref).
 *
 * A members-only post the viewer can't read shows its headline, category, date and cover photo,
 * with a blurred stand-in sentence for the summary: sanity/content left the summary out of
 * Sanity's answer for that viewer, so it never reaches this component.
 */
export function BlogList({ posts, total, page, pageCount, category, children }: BlogListProps) {
  const categoryTitle = category ? optionTitle(POST_CATEGORIES, category) : "";
  return (
    <div className="mx-auto w-full max-w-site px-gutter pt-7 pb-10 md:pb-section">
      <PillLinks
        label="Blog categories"
        className="mb-4.5"
        links={[
          { label: "All", href: blogHref(null), current: category === null },
          ...POST_CATEGORIES.map((option) => ({
            label: option.title,
            href: blogHref(option.value),
            current: option.value === category,
          })),
        ]}
      />
      {/*
        A polite live region: following a pill or page link keeps this element and changes its
        text, so screen readers say what the new list holds. (Next.js's route announcer says only
        "The Blog", whichever filter opened.) With no posts, everyone sees it.
      */}
      <p role="status" className={total === 0 ? "text-muted" : "sr-only"}>
        {summary(total, categoryTitle, page, pageCount)}
        {total === 0 && category && (
          <>
            {" "}
            <Link href={blogHref(null)}>See all posts</Link>
          </>
        )}
      </p>
      {total > 0 && (
        <CardGrid>
          {posts.map((post) => (
            <li key={post._id}>
              <BlogPostCard post={post} />
            </li>
          ))}
        </CardGrid>
      )}
      {pageCount > 1 && <Pages category={category} page={page} pageCount={pageCount} />}
      {children}
    </div>
  );
}

/** How many posts the list holds, and which page this is: "3 Recap posts.", "30 posts, page 2 of 3." */
function summary(total: number, categoryTitle: string, page: number, pageCount: number): string {
  if (total === 0) {
    return categoryTitle ? `No ${categoryTitle} posts yet.` : "No posts yet. Check back soon.";
  }
  const posts = `${total} ${categoryTitle ? `${categoryTitle} ` : ""}${total === 1 ? "post" : "posts"}`;
  return pageCount > 1 ? `${posts}, page ${page} of ${pageCount}.` : `${posts}.`;
}

function BlogPostCard({ post }: { post: PostListItem }) {
  const category = postCategory(post.category);
  const cover = postCover(post.coverImage);
  const common = {
    title: postTitle(post.title),
    href: postPath(post.slug),
    // selectBlogPage keeps only posts with a publish date that reads.
    publishedAt: new Date(publishTime(post.publishedAt) ?? 0),
    category: category.title || undefined,
    membersOnly: post.visibility.audience !== "everyone",
    headingLevel: 2 as const,
    // The headline says what the post is, so the photo is decoration here.
    cover: cover ? (
      <SanityImage
        photo={{ ...cover, alt: "" }}
        fill
        sizes="(min-width: 72.5rem) 17rem, (min-width: 40rem) 50vw, 100vw"
        className="object-cover"
      />
    ) : (
      <PlaceholderPhoto tone={category.value ? PLACEHOLDER_TONES[category.value] : "night"} />
    ),
  };
  return post.access.allowed ? (
    <PostCard {...common} excerpt={postExcerpt(post.content)} />
  ) : (
    <PostCard {...common} locked />
  );
}

/** Newer and older pages of the same filter. */
function Pages({
  category,
  page,
  pageCount,
}: {
  category: PostCategory | null;
  page: number;
  pageCount: number;
}) {
  return (
    <nav
      aria-label="Blog pages"
      className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-small"
    >
      <span>
        {page > 1 && (
          <Link href={blogHref(category, page - 1)} rel="prev">
            <span aria-hidden="true">← </span>Newer posts
          </Link>
        )}
      </span>
      <span className="text-muted">
        Page {page} of {pageCount}
      </span>
      <span className="text-right">
        {page < pageCount && (
          <Link href={blogHref(category, page + 1)} rel="next">
            Older posts<span aria-hidden="true"> →</span>
          </Link>
        )}
      </span>
    </nav>
  );
}
