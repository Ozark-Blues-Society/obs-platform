import { stegaClean } from "next-sanity";
import { HeroBlock } from "@/components/blocks/hero-block";
import { TableBlock } from "@/components/blocks/list-blocks";
import { ImageBlock, QuoteBlock, VideoBlock } from "@/components/blocks/media-blocks";
import { Prose } from "@/components/blocks/prose";
import { RichText } from "@/components/blocks/rich-text";
import { SanityImage } from "@/components/blocks/sanity-image";
import { VideoPlayer } from "@/components/blocks/video-player";
import { MemberFiles } from "@/components/members/member-files";
import { MembersOnlyLock } from "@/components/members/members-only-lock";
import { ButtonLink } from "@/components/ui/button";
import {
  pageTemplate,
  parsePageBlocks,
  type PageBlock,
  type PageContent,
  type PageTemplateName,
} from "@/lib/pages/blocks";
import type { GatedItem } from "@/sanity/content";
import { pagePath } from "@/sanity/paths";
import { PAGE_TEMPLATES, optionTitle } from "@/sanity/schemas/options";
import { MembersOnlyTag, PageTemplate } from "./page-template";

/** A page from sanity/content's getGatedItem with PAGE_CONTENT. */
export type ContentPageItem = GatedItem<"page", PageContent>;

/**
 * A page built in the Studio (backlog C-2), in its template, as this viewer may see it.
 *
 * A viewer who may not see it gets the page header (its title and intro, which are public, as in
 * the approved concept) and a lock worded for why. sanity/content left the page's blocks and files
 * out of Sanity's answer for that viewer, so they never reach this component.
 *
 * Otherwise each block becomes its component (lib/pages/blocks.ts says which are left out). A
 * hero that opens the page takes the page header's place, so its headline is the page's heading;
 * a Band Spotlight's says so above it. On a Directory page, tables get a search box.
 */
export function ContentPage({ page }: { page: ContentPageItem }) {
  const template = pageTemplate(page.template);
  const membersOnly = page.visibility.audience !== "everyone";
  const title = page.title || "Untitled page";
  const intro =
    typeof page.intro === "string" && stegaClean(page.intro).trim() ? page.intro : undefined;

  if (!page.access.allowed) {
    return (
      <PageTemplate title={title} intro={intro} membersOnly={membersOnly}>
        <MembersOnlyLock
          reason={page.access.reason}
          visibility={page.visibility}
          thing="page"
          returnTo={pagePath(page.slug)}
        />
      </PageTemplate>
    );
  }

  const blocks = parsePageBlocks(page.content?.blocks);
  const first = blocks[0];
  const opening = first?.kind === "hero" ? first : undefined;
  return (
    <PageTemplate
      title={title}
      intro={intro}
      membersOnly={membersOnly}
      hero={
        opening && <Hero block={opening} template={template} membersOnly={membersOnly} opensPage />
      }
    >
      {(opening ? blocks.slice(1) : blocks).map((block) => (
        <Block key={block.key} block={block} template={template} />
      ))}
      <MemberFiles files={page.content?.memberFiles} className="" />
    </PageTemplate>
  );
}

type HeroValue = Extract<PageBlock, { kind: "hero" }>;

function Hero({
  block,
  template,
  membersOnly = false,
  opensPage = false,
}: {
  block: HeroValue;
  template: PageTemplateName;
  membersOnly?: boolean;
  /** It's the page's first block, so its headline is the page's level-1 heading. */
  opensPage?: boolean;
}) {
  return (
    <HeroBlock
      headingLevel={opensPage ? 1 : 2}
      heading={block.heading}
      text={block.text}
      eyebrow={
        opensPage && template === "spotlight" ? optionTitle(PAGE_TEMPLATES, template) : undefined
      }
      tag={opensPage && membersOnly ? <MembersOnlyTag /> : undefined}
      photo={
        block.photo && (
          <SanityImage
            photo={block.photo}
            fill
            sizes="100vw"
            preload={opensPage}
            className="object-cover"
          />
        )
      }
      button={block.button}
    />
  );
}

function Block({ block, template }: { block: PageBlock; template: PageTemplateName }) {
  switch (block.kind) {
    case "hero":
      return <Hero block={block} template={template} />;
    case "text":
      return (
        <Prose>
          <RichText value={block.body} />
        </Prose>
      );
    case "image":
      return (
        <ImageBlock
          image={
            <SanityImage
              photo={block.photo}
              fill
              sizes="(min-width: 48rem) 48rem, 100vw"
              className="object-cover"
            />
          }
          caption={block.caption}
        />
      );
    case "video":
      return (
        <VideoBlock
          title={block.title}
          caption={block.caption}
          player={<VideoPlayer embed={block.embed} title={block.title} />}
        />
      );
    case "table":
      return (
        <TableBlock
          heading={block.heading}
          columns={block.columns}
          rows={block.rows}
          searchLabel={template === "directory" ? `Search ${block.heading}` : undefined}
        />
      );
    case "button":
      return (
        <div>
          <ButtonLink href={block.href}>{block.label}</ButtonLink>
        </div>
      );
    case "quote":
      return <QuoteBlock quote={block.quote} attribution={block.attribution} />;
    // These fill themselves from other content, each with its own loader: upcoming events and
    // sponsor logos come in C-2's second part, the venue directory with M-9 and the volunteer form
    // with P-5. Until then they show nothing.
    case "upcomingEvents":
    case "sponsorStrip":
    case "directory":
    case "form":
      return null;
  }
}
