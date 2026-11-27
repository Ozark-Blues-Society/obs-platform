import type { Metadata } from "next";
import { stegaClean } from "next-sanity";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { PostView } from "@/components/blog/post-view";
import { isPublished, POST_CONTENT, type PostContent } from "@/lib/blog/posts";
import { getGatedItem } from "@/sanity/content";

// A blog post (backlog P-3), at /blog/<web address>: its headline, category, date and cover photo
// for anyone, then the post for viewers who may read it, or a lock for everyone else (M-7). A post
// with a later publish date is scheduled: not found until then, except in a preview.
//
// The post is read through sanity/content, which leaves the summary, the post, its author and its
// files out of Sanity's answer for a viewer who may not read it, so they never reach this page,
// its HTML or its RSC payload. It reads the session, so everything below the layout renders at
// request time.

/** Web addresses as the Studio makes them (sanity/schemas/validation.ts slugRule). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// One read per request, shared by the metadata and the page. An address no post could have isn't
// sent to Sanity, and a scheduled post isn't there until its date, so neither the page nor its
// tab title can give away its headline early.
const loadPost = cache(async (slug: string) => {
  if (!SLUG.test(slug)) return null;
  const [post, { isEnabled: preview }] = await Promise.all([
    getGatedItem<"post", PostContent>("post", slug, POST_CONTENT),
    draftMode(),
  ]);
  return post && (preview || isPublished(post.publishedAt, new Date())) ? post : null;
});

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await loadPost((await params).slug);
  // The headline is public, like the page header that shows it. In a preview it carries edit
  // markers.
  const title = typeof post?.title === "string" ? stegaClean(post.title).trim() : "";
  return title ? { title: `${title} · Ozark Blues Society` } : {};
}

export default function PostPage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  const post = await loadPost((await params).slug);
  if (!post) notFound();
  return <PostView post={post} />;
}
