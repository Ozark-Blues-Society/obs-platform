import type { Metadata } from "next";
import { PortableText, stegaClean, type PortableTextBlock } from "next-sanity";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MemberFiles, type MemberFileLink } from "@/components/members/member-files";
import { MembersOnlyLock } from "@/components/members/members-only-lock";
import { Tag } from "@/components/ui/tag";
import { formatSocietyDate } from "@/lib/society-time";
import { getGatedItem } from "@/sanity/content";
import { postPath } from "@/sanity/paths";
import { POST_CATEGORIES, optionTitle } from "@/sanity/schemas/options";

// A blog post (backlog P-3), as far as members-only gating needs it (M-7): the headline, category
// and date for anyone, then the post itself for viewers who may read it, or a lock for everyone
// else. P-3 adds the blog list, the cover photo, photos in the text, the author and the design.
//
// The post is read through sanity/content, which leaves the summary, the post and its files out
// of Sanity's answer for a viewer who may not read it, so they never reach this page, its HTML or
// its RSC payload. It reads the session, so everything below the layout renders at request time.

export const metadata: Metadata = {
  title: "Blog · Ozark Blues Society",
};

/** The members-only fields: from other documents, only what the rule allows (sanity/content). */
const POST_CONTENT = "{ excerpt, body, memberFiles[]{ title, fileId } }";

type PostContent = {
  excerpt?: string;
  body?: PortableTextBlock[];
  memberFiles?: MemberFileLink[];
};

export default function PostPage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  const { slug } = await params;
  const post = await getGatedItem<"post", PostContent>("post", slug, POST_CONTENT);
  if (!post) notFound();
  // A post with a later publish date is scheduled: hidden until then, except in a preview.
  const { isEnabled: preview } = await draftMode();
  if (!preview && !isPublished(post.publishedAt)) notFound();

  const category = optionTitle(POST_CATEGORIES, stegaClean(post.category ?? ""));
  const date = post.publishedAt ? formatSocietyDate(stegaClean(post.publishedAt)) : "";
  const { access, content } = post;

  return (
    <>
      <PageHeader title={post.title} eyebrow={[category, date].filter(Boolean).join(" · ")}>
        {post.visibility.audience !== "everyone" && (
          <Tag tone="accent" className="mt-3">
            Members only
          </Tag>
        )}
      </PageHeader>
      <div className="mx-auto w-full max-w-site px-gutter py-10">
        {access.allowed && content ? (
          <article className="max-w-prose">
            {content.excerpt && <p className="text-lead text-muted">{content.excerpt}</p>}
            {content.body && (
              <div className="mt-6 grid gap-4">
                <PortableText value={content.body} />
              </div>
            )}
            <MemberFiles files={content.memberFiles} />
          </article>
        ) : (
          !access.allowed && (
            <MembersOnlyLock
              reason={access.reason}
              visibility={post.visibility}
              thing="post"
              returnTo={postPath(slug)}
            />
          )
        )}
      </div>
    </>
  );
}

function isPublished(publishedAt: string | undefined): boolean {
  const time = publishedAt ? Date.parse(stegaClean(publishedAt)) : Number.NaN;
  return Number.isFinite(time) && time <= Date.now();
}
