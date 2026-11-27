import Link from "next/link";
import { Prose } from "@/components/blocks/prose";
import { RichText } from "@/components/blocks/rich-text";
import { SanityImage } from "@/components/blocks/sanity-image";
import { PageHeader } from "@/components/layout/page-header";
import { MemberFiles } from "@/components/members/member-files";
import { MembersOnlyLock } from "@/components/members/members-only-lock";
import { MembersOnlyTag } from "@/components/templates/page-template";
import {
  postAuthor,
  postBody,
  postCategory,
  postCover,
  postExcerpt,
  postTitle,
  publishTime,
  type PostAuthor,
  type PostContent,
  type PostItem,
} from "@/lib/blog/posts";
import { formatSocietyDate } from "@/lib/society-time";
import { BLOG_PATH, postPath } from "@/sanity/paths";

/**
 * A blog post (backlog P-3), as this viewer may see it. Anyone gets the headline, category, date
 * and cover photo, which are public, as on the post's card.
 *
 * A viewer who may not read it gets a lock worded for why: sanity/content left the summary, the
 * post, its author and its files out of Sanity's answer for that viewer, so they never reach this
 * component, the page's HTML or its RSC payload.
 */
export function PostView({ post }: { post: PostItem }) {
  const category = postCategory(post.category);
  const time = publishTime(post.publishedAt);
  const cover = postCover(post.coverImage);
  const { access, content } = post;

  return (
    <>
      <PageHeader
        title={postTitle(post.title)}
        eyebrow={
          (category.title || time !== null) && (
            <>
              {category.title}
              {category.title && time !== null && " · "}
              {time !== null && (
                <time dateTime={new Date(time).toISOString()}>
                  {formatSocietyDate(new Date(time))}
                </time>
              )}
            </>
          )
        }
      >
        {post.visibility.audience !== "everyone" && (
          <div className="mt-3">
            <MembersOnlyTag />
          </div>
        )}
      </PageHeader>
      <div className="mx-auto w-full max-w-site px-gutter py-10 md:pb-section">
        {cover && (
          // As wide as the page templates' photo block (components/blocks/media-blocks.tsx).
          <div className="relative mb-8 aspect-video max-w-3xl overflow-hidden rounded-card bg-muted-soft">
            <SanityImage
              photo={cover}
              fill
              preload
              sizes="(min-width: 50.5rem) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        )}
        {access.allowed ? (
          content && (
            <Article
              excerpt={postExcerpt(content)}
              body={postBody(content.body)}
              author={postAuthor(content.author)}
              files={content.memberFiles}
            />
          )
        ) : (
          <MembersOnlyLock
            reason={access.reason}
            visibility={post.visibility}
            thing="post"
            returnTo={postPath(post.slug)}
          />
        )}
        <p className="mt-10">
          <Link href={BLOG_PATH}>
            <span aria-hidden="true">← </span>All posts
          </Link>
        </p>
      </div>
    </>
  );
}

/** The post itself: the summary, the byline, the text, the files and who wrote it. */
function Article({
  excerpt,
  body,
  author,
  files,
}: {
  excerpt?: string;
  body: ReturnType<typeof postBody>;
  author?: PostAuthor;
  files: PostContent["memberFiles"];
}) {
  return (
    <article className="max-w-prose">
      {excerpt && <p className="text-lead text-muted">{excerpt}</p>}
      {author && <p className="mt-4 text-small text-muted">By {author.name}</p>}
      {body.length > 0 && (
        <Prose className="mt-8">
          <RichText value={body} />
        </Prose>
      )}
      <MemberFiles files={files} />
      {author && (author.bio || author.photo) && <AboutAuthor author={author} />}
    </article>
  );
}

/** The author's photo, role and bio from People, under the post. */
function AboutAuthor({ author }: { author: PostAuthor }) {
  return (
    <footer className="mt-10 flex items-start gap-4 border-t border-line pt-6">
      {author.photo && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-primary-soft">
          {/* The name is right beside it, so the photo is decoration here. */}
          <SanityImage
            photo={{ ...author.photo, alt: "" }}
            fill
            sizes="4rem"
            className="object-cover"
          />
        </div>
      )}
      <div>
        <p className="font-semibold">
          {author.name}
          {author.role && <span className="font-normal text-muted"> · {author.role}</span>}
        </p>
        {author.bio && <p className="mt-1 text-small">{author.bio}</p>}
      </div>
    </footer>
  );
}
