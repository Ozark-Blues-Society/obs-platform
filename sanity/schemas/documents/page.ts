import { defineArrayMember, defineField, defineType } from "sanity";
import { slugField, visibilityField } from "../fields";
import {
  AUDIENCES,
  MENU_PLACEMENTS,
  PAGE_TEMPLATES,
  RESERVED_PAGE_SLUGS,
  optionList,
  optionTitle,
} from "../options";
import { pageBlocks } from "../page-blocks";
import { pagePath } from "../../paths";

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Page title",
      type: "string",
      description: "The page's main heading. Browser tabs and search results show it too.",
      validation: (rule) => rule.required().max(100),
    }),
    slugField({ path: pagePath, example: "about-and-volunteer", reserved: RESERVED_PAGE_SLUGS }),
    defineField({
      name: "template",
      title: "Template",
      type: "string",
      description:
        "The page's layout. Standard suits most pages; Directory is for lists such as the venue directory; Band Spotlight for profiles; Promo Feature for campaigns.",
      options: { list: optionList(PAGE_TEMPLATES) },
      initialValue: "standard",
      validation: (rule) => rule.required(),
    }),
    visibilityField("page"),
    defineField({
      name: "menuPlacement",
      title: "Show in menu",
      type: "string",
      description: "Where a link to this page appears in the site's menus.",
      options: { list: optionList(MENU_PLACEMENTS) },
      initialValue: "none",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "blocks",
      title: "Page blocks",
      type: "array",
      of: pageBlocks.map((block) => defineArrayMember({ type: block.name })),
      description:
        "The page's sections, top to bottom. Add, move or remove blocks: each one keeps the Society's design.",
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { title: "title", template: "template", audience: "visibility.audience" },
    prepare: ({ title, template, audience }: Record<string, string | undefined>) => ({
      title: title || "Untitled page",
      subtitle: [
        optionTitle(PAGE_TEMPLATES, template),
        audience && audience !== "everyone" ? `🔒 ${optionTitle(AUDIENCES, audience)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }),
  },
});
