import { defineArrayMember, defineField, defineType } from "sanity";
import { hrefRule, imageAltRule } from "../validation";

/**
 * Formatted text (Portable Text) for post and event descriptions and the page text block: headings,
 * bold, italic, links, lists and quotes, with photos and videos between paragraphs. Pasting from
 * Word or Google Docs keeps this formatting.
 */
export const richText = defineType({
  name: "richText",
  title: "Text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading", value: "h2" },
        { title: "Subheading", value: "h3" },
        { title: "Quote", value: "blockquote" },
      ],
      lists: [
        { title: "Bulleted list", value: "bullet" },
        { title: "Numbered list", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
        ],
        annotations: [
          defineArrayMember({
            name: "link",
            title: "Link",
            type: "object",
            fields: [
              defineField({
                name: "href",
                title: "Link to",
                type: "string",
                description:
                  "A web address (https://…), a part of this site such as /events, or an email address (mailto:name@example.com).",
                validation: (rule) => rule.required().custom(hrefRule),
              }),
            ],
          }),
        ],
      },
    }),
    defineArrayMember({
      type: "image",
      title: "Photo",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
          description: "Describe the photo for people who can't see it.",
          validation: (rule) => rule.custom(imageAltRule),
        }),
        defineField({
          name: "caption",
          title: "Caption",
          type: "string",
          description: "Optional. Shown under the photo, for example who took it.",
        }),
      ],
    }),
    defineArrayMember({ type: "videoBlock" }),
  ],
});
