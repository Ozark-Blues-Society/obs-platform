import type { Metadata } from "next";
import { stegaClean } from "next-sanity";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ContentPage } from "@/components/templates/content-page";
import { PAGE_CONTENT, type PageContent } from "@/lib/pages/blocks";
import { getGatedItem } from "@/sanity/content";

// Pages built in the Studio (backlog C-2), at /<web address>: About & Volunteer, a band spotlight,
// the venue directory and the rest. The app's own routes (RESERVED_PAGE_SLUGS) come first, so a
// page can't take their addresses.
//
// The page is read through sanity/content, which leaves a members-only page's blocks and files out
// of Sanity's answer for a viewer who may not see them. It reads the session, so everything below
// the layout renders at request time.

/** Web addresses as the Studio makes them (sanity/schemas/validation.ts slugRule). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// One read per request, shared by the metadata and the page. An address no page could have isn't
// sent to Sanity at all.
const loadPage = cache(async (slug: string) =>
  SLUG.test(slug) ? getGatedItem<"page", PageContent>("page", slug, PAGE_CONTENT) : null,
);

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const page = await loadPage((await params).slug);
  // The title is public, like the page header that shows it. In a preview it carries edit markers.
  const title = page?.title ? stegaClean(page.title).trim() : "";
  return title ? { title: `${title} · Ozark Blues Society` } : {};
}

export default function Page({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
      <PageContentFor params={params} />
    </Suspense>
  );
}

async function PageContentFor({ params }: Pick<PageProps<"/[slug]">, "params">) {
  const page = await loadPage((await params).slug);
  if (!page) notFound();
  return <ContentPage page={page} />;
}
