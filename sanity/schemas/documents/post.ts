import { defineField, defineType, type PreviewValue } from "sanity";
import {
  imageField,
  memberFilesField,
  slugField,
  societyDatetimeOptions,
  visibilityField,
} from "../fields";
import { POST_CATEGORIES, SOCIETY_TIME_ZONE, optionList, optionTitle } from "../options";
import { postPath } from "../../paths";

type Selection = {
  title?: string;
  publishedAt?: string;
  category?: string;
  audience?: string;
  media?: PreviewValue["media"];
};

export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Headline",
      type: "string",
      description: "The post's title, on blog cards and at the top of the post.",
      validation: (rule) => rule.required().max(120),
    }),
    slugField({ path: postPath, example: "fall-fest-recap" }),
    imageField({
      name: "coverImage",
      title: "Cover photo",
      description:
        "Shown on blog cards and at the top of the post. Drag the circle onto the important part so it crops well everywhere.",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      description: "Readers can filter the blog by category.",
      options: { list: optionList(POST_CATEGORIES) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      to: [{ type: "person" }],
      description:
        "Optional. Who wrote it: someone from People, or a team such as Communications Team.",
    }),
    defineField({
      name: "excerpt",
      title: "Short summary",
      type: "text",
      rows: 3,
      description: "One or two sentences for blog cards and the email digest.",
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: "body",
      title: "Post",
      type: "richText",
      description:
        "Write the post, or paste it from Word or Google Docs and the formatting comes along. Add photos between paragraphs.",
      validation: (rule) => rule.required(),
    }),
    memberFilesField("post"),
    visibilityField("post"),
    defineField({
      name: "includeInDigest",
      title: "Include in the monthly email digest",
      type: "boolean",
      description: "Adds the headline and summary to the next monthly digest email.",
      initialValue: false,
    }),
    defineField({
      name: "publishedAt",
      title: "When to publish",
      type: "datetime",
      description:
        "The date the post shows, in Central Time. Choose a later date and time to schedule it: the post stays hidden until then.",
      options: societyDatetimeOptions,
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [
    {
      title: "Publish date, latest first",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      publishedAt: "publishedAt",
      category: "category",
      audience: "visibility.audience",
      media: "coverImage",
    },
    prepare: ({ title, publishedAt, category, audience, media }: Selection) => ({
      title: title || "Untitled post",
      subtitle: [
        publishedAt
          ? new Intl.DateTimeFormat("en-US", {
              timeZone: SOCIETY_TIME_ZONE,
              dateStyle: "medium",
            }).format(new Date(publishedAt))
          : "",
        optionTitle(POST_CATEGORIES, category),
        audience && audience !== "everyone" ? "🔒" : "",
      ]
        .filter(Boolean)
        .join(" · "),
      media,
    }),
  },
});
