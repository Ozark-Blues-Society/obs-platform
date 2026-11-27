// A page's blocks as the site draws them (backlog C-2): what Sanity returns for PAGE_CONTENT,
// checked and turned into plain values for the components in components/blocks/
// (components/templates/content-page.tsx puts them together). A block that is incomplete, such as
// a draft's photo block with no photo yet, or of a type this code doesn't know, is left out, so a
// half-finished block or a newer schema can't break a page. No server code, so tests can run it.
import { stegaClean, type PortableTextBlock } from "next-sanity";
import type { MemberFileLink } from "@/components/members/member-files";
import { safeHref } from "@/lib/site/navigation";
import { LINK_TARGET } from "@/sanity/content/gated-query";
import { eventPath, pagePath, postPath } from "@/sanity/paths";
import { FORMS, PAGE_TEMPLATES, type OptionValue } from "@/sanity/schemas/options";
import { videoEmbed, type VideoEmbed } from "./video";

/** A link object's fields (sanity/schemas/objects/link.ts), with its target's public fields. */
const LINK = `{ href, "target": internal->${LINK_TARGET} }`;

/**
 * A page's members-only fields: its blocks and files, for sanity/content's getGatedItem. Buttons
 * take only LINK_TARGET from the page, post or event they point at, because a dereference skips
 * that document's gate. The blocks that fill themselves load their content with their own calls.
 */
export const PAGE_CONTENT = `{ blocks[]{ ..., button{ label, link${LINK} }, link${LINK} }, memberFiles[]{ title, fileId } }`;

/** What getGatedItem returns in `content` for PAGE_CONTENT. */
export type PageContent = { blocks?: unknown; memberFiles?: MemberFileLink[] };

export type PageTemplateName = OptionValue<typeof PAGE_TEMPLATES>;

/** A page's template, or Standard for a value this code doesn't know. */
export function pageTemplate(value: unknown): PageTemplateName {
  const name = plain(value);
  return PAGE_TEMPLATES.find((template) => template.value === name)?.value ?? "standard";
}

/** A Sanity image for next-sanity's `<Image>`: the asset, with the editor's crop and focal point. */
export type SanityImageSource = {
  asset: { _ref: string };
  crop?: Record<"top" | "bottom" | "left" | "right", number>;
  hotspot?: Record<"x" | "y" | "width" | "height", number>;
};

export type BlockPhoto = { image: SanityImageSource; alt: string };
export type BlockButton = { label: string; href: string };
export type BlockVideo = { title: string; caption?: string; embed: VideoEmbed };

type Keyed = { key: string };

export type PageBlock = Keyed &
  (
    | { kind: "hero"; heading: string; text?: string; photo?: BlockPhoto; button?: BlockButton }
    | { kind: "text"; body: PortableTextBlock[] }
    | { kind: "image"; photo: BlockPhoto; caption?: string }
    | ({ kind: "video" } & BlockVideo)
    | { kind: "upcomingEvents"; heading: string; count: number }
    | { kind: "sponsorStrip"; heading: string; sponsorIds: string[] }
    | { kind: "table"; heading: string; columns: string[]; rows: string[][] }
    | { kind: "directory"; heading: string }
    | ({ kind: "button" } & BlockButton)
    | { kind: "quote"; quote: string; attribution?: string }
    | {
        kind: "form";
        form: OptionValue<typeof FORMS>;
        heading?: string;
        intro?: string;
      }
  );

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// In a preview, strings carry invisible edit markers (stega) that let editors click text to edit
// it. Text people read keeps them; values the site acts on (links, choices, codes) are cleaned.
const text = (value: unknown): string | undefined =>
  typeof value === "string" && stegaClean(value).trim() !== "" ? value : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATHS: Record<string, (slug: string) => string> = {
  page: pagePath,
  post: postPath,
  event: eventPath,
};

/**
 * Where a link object goes: the page, post or event it points at (its LINK_TARGET), or its web
 * address if that's safe to link to. Null for neither, such as a link to a page that was deleted
 * or isn't published yet.
 */
export function linkHref(value: unknown): string | null {
  const link = fields(value);
  if (!link) return null;
  const target = fields(link.target);
  const type = plain(target?._type);
  const slug = plain(target?.slug);
  if (Object.hasOwn(PATHS, type) && SLUG.test(slug)) return PATHS[type](slug);
  return safeHref(plain(link.href));
}

/** Sanity image asset ids name the file: image-<hash>-<width>x<height>-<format>. */
const IMAGE_ASSET = /^image-[A-Za-z0-9]+-\d+x\d+-[a-z0-9]+$/;

function numbers<K extends string>(
  value: unknown,
  keys: readonly K[],
): Record<K, number> | undefined {
  const found = fields(value);
  if (!found) return undefined;
  const result = {} as Record<K, number>;
  for (const key of keys) {
    const number = found[key];
    if (typeof number !== "number" || !Number.isFinite(number)) return undefined;
    result[key] = number;
  }
  return result;
}

/** A photo with its alt text, or undefined if it has no image yet (a draft's empty field). */
export function blockPhoto(value: unknown): BlockPhoto | undefined {
  const image = fields(value);
  const ref = plain(fields(image?.asset)?._ref);
  if (!IMAGE_ASSET.test(ref)) return undefined;
  const crop = numbers(image?.crop, ["top", "bottom", "left", "right"]);
  const hotspot = numbers(image?.hotspot, ["x", "y", "width", "height"]);
  return {
    image: { asset: { _ref: ref }, ...(crop && { crop }), ...(hotspot && { hotspot }) },
    alt: plain(image?.alt),
  };
}

/** A video block's player, or undefined if its link can't be embedded or it has no title. */
export function blockVideo(value: unknown): BlockVideo | undefined {
  const video = fields(value);
  const embed = videoEmbed(plain(video?.url));
  // The player's title names it for screen readers, so it's required, like the Studio's field.
  const title = plain(video?.title);
  if (!embed || !title) return undefined;
  return { title, caption: text(video?.caption), embed };
}

function blockButton(value: unknown): BlockButton | undefined {
  const button = fields(value);
  const label = text(button?.label);
  const href = linkHref(button?.link);
  return label && href ? { label, href } : undefined;
}

/** A typed table's cells: one per column in every row, and no empty rows. */
function tableRows(rows: unknown, columns: number): string[][] {
  return list(rows).flatMap((row) => {
    const cells = list(fields(row)?.cells);
    const padded = Array.from({ length: columns }, (_, index) => text(cells[index]) ?? "");
    return padded.some((cell) => cell !== "") ? [padded] : [];
  });
}

type BlockValue = PageBlock extends infer B ? (B extends Keyed ? Omit<B, "key"> : never) : never;

function parseBlock(block: Fields): BlockValue | undefined {
  switch (plain(block._type)) {
    case "heroBlock": {
      const heading = text(block.heading);
      if (!heading) return undefined;
      return {
        kind: "hero",
        heading,
        text: text(block.text),
        photo: blockPhoto(block.image),
        button: blockButton(block.button),
      };
    }
    case "textBlock": {
      const body = list(block.body).filter((item): item is PortableTextBlock => !!fields(item));
      return body.length > 0 ? { kind: "text", body } : undefined;
    }
    case "imageBlock": {
      const photo = blockPhoto(block.image);
      return photo ? { kind: "image", photo, caption: text(block.caption) } : undefined;
    }
    case "videoBlock": {
      const video = blockVideo(block);
      return video ? { kind: "video", ...video } : undefined;
    }
    case "upcomingEventsBlock": {
      const heading = text(block.heading);
      const count = block.count;
      if (!heading) return undefined;
      return {
        kind: "upcomingEvents",
        heading,
        count:
          Number.isInteger(count) && Number(count) >= 1 && Number(count) <= 12 ? Number(count) : 3,
      };
    }
    case "sponsorStripBlock": {
      const heading = text(block.heading);
      if (!heading) return undefined;
      const sponsorIds = list(block.sponsors)
        .map((sponsor) => plain(fields(sponsor)?._ref))
        .filter(Boolean);
      return { kind: "sponsorStrip", heading, sponsorIds };
    }
    case "tableBlock": {
      const heading = text(block.heading);
      if (!heading) return undefined;
      if (plain(block.source) === "directory") return { kind: "directory", heading };
      const columns = list(block.columns).map((column) => text(column) ?? "");
      const rows = tableRows(block.rows, columns.length);
      return columns.length > 0 && rows.length > 0
        ? { kind: "table", heading, columns, rows }
        : undefined;
    }
    case "buttonBlock": {
      const button = blockButton(block);
      return button ? { kind: "button", ...button } : undefined;
    }
    case "quoteBlock": {
      const quote = text(block.quote);
      return quote ? { kind: "quote", quote, attribution: text(block.attribution) } : undefined;
    }
    case "formBlock": {
      const form = FORMS.find((option) => option.value === plain(block.form))?.value;
      return form
        ? { kind: "form", form, heading: text(block.heading), intro: text(block.intro) }
        : undefined;
    }
    default:
      return undefined;
  }
}

/** The blocks to draw, top to bottom, leaving out any that are incomplete or of an unknown type. */
export function parsePageBlocks(value: unknown): PageBlock[] {
  const keys = new Set<string>();
  return list(value).flatMap((item, index) => {
    const block = fields(item);
    const parsed = block && parseBlock(block);
    if (!parsed) return [];
    // React needs a unique key per block: Sanity's _key, or the position if that's missing or used.
    let key = plain(block._key);
    if (!key || keys.has(key)) key = `block-${index}`;
    keys.add(key);
    return [{ ...parsed, key } as PageBlock];
  });
}
