import { defineArrayMember, defineField, defineType } from "sanity";
import { memberFilesField, slugField, visibilityField } from "../fields";
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
    defineField({
      name: "intro",
      title: "Intro",
      type: "text",
      rows: 2,
      description:
        "Optional. A sentence under the title, in the blue band at the top of the page. Like the title, everyone sees it, even on a members-only page. A page that starts with a hero photo shows the hero's text instead.",
      validation: (rule) => rule.max(200),
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
      // Not "order": that name clashes with GROQ's order() function.
      name: "menuOrder",
      title: "Position in menu",
      type: "number",
      description:
        "Optional. Pages in the same menu are listed from the lowest number up, for example 1, 2, 3. Pages without a number come after, in title order.",
      hidden: ({ parent }) => {
        const placement = (parent as { menuPlacement?: string } | undefined)?.menuPlacement;
        return !placement || placement === "none";
      },
      validation: (rule) => rule.integer().min(1).max(99),
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
    memberFilesField("page"),
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
