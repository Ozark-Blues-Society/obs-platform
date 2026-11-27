// The blocks a page is built from (docs/spec/architecture.md). Editors fill them in and C-2 draws
// each one in the Society's design, so a page can't break the layout. The type names end in
// "Block" because Sanity has built-in types called text and image.
import { defineArrayMember, defineField, defineType, type PreviewValue } from "sanity";
import { imageField } from "./fields";
import { FORMS, optionList } from "./options";
import { tableColumnsRule, tableRowsRule, videoUrlRule } from "./validation";

/** List preview: the block's own title (or its kind) with its kind underneath. */
function preview(kind: string, titleField: string) {
  return {
    select: { title: titleField },
    prepare: ({ title }: { title?: string }) => ({ title: title || kind, subtitle: kind }),
  };
}

export const heroBlock = defineType({
  name: "heroBlock",
  title: "Hero photo and headline",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Headline",
      type: "string",
      description: "The big headline over the photo.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "text",
      title: "Text",
      type: "text",
      rows: 2,
      description: "Optional. A sentence or two under the headline.",
    }),
    imageField({
      name: "image",
      title: "Photo",
      description: "A wide photo. Set the focal point so faces stay in view on phones.",
      required: true,
    }),
    defineField({
      name: "button",
      title: "Button",
      type: "buttonBlock",
      description: "Optional. A button under the headline, for example Apply to compete.",
    }),
  ],
  preview: preview("Hero photo and headline", "heading"),
});

export const textBlock = defineType({
  name: "textBlock",
  title: "Text",
  type: "object",
  fields: [
    defineField({
      name: "body",
      title: "Text",
      type: "richText",
      description: "Write or paste text. Headings, bold, links, lists, photos and videos all work.",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { blocks: "body" },
    prepare: ({ blocks }: { blocks?: { children?: { text?: string }[] }[] }) => ({
      title:
        blocks
          ?.flatMap((block) => block.children ?? [])
          .map((span) => span.text ?? "")
          .join(" ")
          .slice(0, 80) || "Text",
      subtitle: "Text",
    }),
  },
});

export const imageBlock = defineType({
  name: "imageBlock",
  title: "Photo",
  type: "object",
  fields: [
    imageField({
      name: "image",
      title: "Photo",
      description: "Set the focal point so the important part stays in view on phones.",
      required: true,
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional. Shown under the photo, for example who took it.",
    }),
  ],
  preview: {
    select: { title: "caption", alt: "image.alt", media: "image" },
    prepare: ({
      title,
      alt,
      media,
    }: {
      title?: string;
      alt?: string;
      media?: PreviewValue["media"];
    }) => ({
      title: title || alt || "Photo",
      subtitle: "Photo",
      media,
    }),
  },
});

export const videoBlock = defineType({
  name: "videoBlock",
  title: "Video or Bandcamp player",
  type: "object",
  fields: [
    defineField({
      name: "url",
      title: "Link",
      type: "url",
      description:
        "The link to a YouTube or Vimeo video. For Bandcamp, choose Share / Embed on the album, then copy the link inside the code that starts with https://bandcamp.com/EmbeddedPlayer/.",
      validation: (rule) => rule.required().custom(videoUrlRule),
    }),
    defineField({
      name: "title",
      title: "What it is",
      type: "string",
      description:
        "A few words that screen readers announce, for example: The Muddy Ridge Trio live at Old Mill.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional. Shown under the player.",
    }),
  ],
  preview: preview("Video or Bandcamp player", "title"),
});

export const upcomingEventsBlock = defineType({
  name: "upcomingEventsBlock",
  title: "Upcoming events (fills itself)",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "The title above the list.",
      initialValue: "Upcoming shows",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "count",
      title: "How many events",
      type: "number",
      description: "The list shows the next events from the calendar, soonest first.",
      initialValue: 3,
      validation: (rule) => rule.required().integer().min(1).max(12),
    }),
  ],
  preview: preview("Upcoming events (fills itself)", "heading"),
});

export const sponsorStripBlock = defineType({
  name: "sponsorStripBlock",
  title: "Sponsor logos (fills itself)",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "The title above the logos.",
      initialValue: "Thanks to our sponsors",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sponsors",
      title: "Which sponsors",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "sponsor" }] })],
      description:
        "Leave empty to show every current sponsor, or pick some, such as an event's own sponsors. Sponsors past their end date never show.",
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: preview("Sponsor logos (fills itself)", "heading"),
});

export const tableBlock = defineType({
  name: "tableBlock",
  title: "Table",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "The title above the table. Screen readers announce it with the table.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "source",
      title: "What the table shows",
      type: "string",
      description:
        "The venue directory fills itself from Directory entries. Only members whose membership is active see its rows, and only Band, Business and Sponsor members see booking contacts, whoever can see the page.",
      options: {
        list: [
          { value: "custom", title: "Rows I type here" },
          { value: "directory", title: "The venue directory" },
        ],
        layout: "radio",
      },
      initialValue: "custom",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "columns",
      title: "Column headings",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      description: "One heading per column, in order from left to right.",
      hidden: ({ parent }) => (parent as { source?: string } | undefined)?.source === "directory",
      validation: (rule) => rule.custom(tableColumnsRule),
    }),
    defineField({
      name: "rows",
      title: "Rows",
      type: "array",
      of: [
        defineArrayMember({
          name: "tableRow",
          title: "Row",
          type: "object",
          fields: [
            defineField({
              name: "cells",
              title: "Cells",
              type: "array",
              of: [defineArrayMember({ type: "string" })],
              description: "One cell per column, in the same order as the column headings.",
            }),
          ],
          preview: {
            select: { cells: "cells" },
            prepare: ({ cells }: { cells?: string[] }) => ({
              title: cells?.join(" · ") || "Empty row",
            }),
          },
        }),
      ],
      description: "Each row needs one cell for every column.",
      hidden: ({ parent }) => (parent as { source?: string } | undefined)?.source === "directory",
      validation: (rule) => rule.custom(tableRowsRule),
    }),
  ],
  preview: preview("Table", "heading"),
});

export const buttonBlock = defineType({
  name: "buttonBlock",
  title: "Button",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Button text",
      type: "string",
      description: "A few words that say what happens, for example Join now or Apply to compete.",
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: "link",
      title: "Goes to",
      type: "link",
      description: "Where the button takes people.",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: preview("Button", "label"),
});

export const quoteBlock = defineType({
  name: "quoteBlock",
  title: "Pull quote",
  type: "object",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 3,
      description: "The words to highlight, without quotation marks.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "attribution",
      title: "Who said it",
      type: "string",
      description: "Optional. A name, and a role if it helps: Lou Tate, harmonica.",
    }),
  ],
  preview: preview("Pull quote", "quote"),
});

export const formBlock = defineType({
  name: "formBlock",
  title: "Form",
  type: "object",
  fields: [
    defineField({
      name: "form",
      title: "Which form",
      type: "string",
      description: "The form to show. A developer adds new kinds of forms.",
      options: { list: optionList(FORMS), layout: "radio" },
      initialValue: "volunteer",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      description: "Optional. A title above the form, for example Sign up to volunteer.",
    }),
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 2,
      description: "Optional. A sentence above the form that says what happens after sending it.",
    }),
  ],
  preview: preview("Form", "heading"),
});

/** The block types a page's "Page blocks" list offers, in menu order. */
export const pageBlocks = [
  heroBlock,
  textBlock,
  imageBlock,
  videoBlock,
  upcomingEventsBlock,
  sponsorStripBlock,
  tableBlock,
  buttonBlock,
  quoteBlock,
  formBlock,
];
