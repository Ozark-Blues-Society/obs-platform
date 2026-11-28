import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { Suspense } from "react";
import { BlogList } from "@/components/blog/blog-list";
import { PageHeader } from "@/components/layout/page-header";
import {
  blogCategory,
  blogPageNumber,
  blogTitle,
  POST_LIST_CONTENT,
  POST_LIST_ORDER,
  selectBlogPage,
  type PostListContent,
} from "@/lib/blog/posts";
import { listGatedItems } from "@/sanity/content";
import { NewsletterBox } from "./newsletter-box";

// The blog (backlog P-3): every post that's out, latest first, filtered by category with
// ?category=, in pages with ?page= (lib/blog/posts.ts). A scheduled post stays out of the list
// until its publish date, except in a preview.
//
// Posts are read through sanity/content, which leaves a members-only post's summary out of
// Sanity's answer for a viewer who may not read it. It reads the session, so the list renders at
// request time, below the page header.
//
// The list ends with the newsletter signup box (decision 0015) while MailerLite is connected
// (MAILERLITE_API_KEY). It's decided with the list, at request time, never when the site is built.

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const query = await searchParams;
  return { title: blogTitle(blogCategory(query.category), blogPageNumber(query.page)) };
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <PageHeader
        title="The Blog"
        intro="Replacing the printed newsletter — every post can also go out by email."
      />
      <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Posts({ searchParams }: Pick<PageProps<"/blog">, "searchParams">) {
  const query = await searchParams;
  const category = blogCategory(query.category);
  const [posts, { isEnabled: preview }] = await Promise.all([
    listGatedItems<"post", PostListContent>("post", POST_LIST_CONTENT, { order: POST_LIST_ORDER }),
    draftMode(),
  ]);
  const page = selectBlogPage(posts, {
    category,
    page: blogPageNumber(query.page),
    now: new Date(),
    preview,
  });
  return (
    <BlogList category={category} {...page}>
      <NewsletterBox />
    </BlogList>
  );
}
