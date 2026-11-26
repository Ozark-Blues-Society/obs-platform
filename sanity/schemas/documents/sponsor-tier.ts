import { defineArrayMember, defineField, defineType } from "sanity";
import { LOGO_PLACEMENTS, optionList } from "../options";

/**
 * Sponsor tiers are data, so the board can add the three planned tiers in the Studio without code
 * changes (board-decisions §8). Until then there's one tier, "Sponsor".
 */
export const sponsorTier = defineType({
  name: "sponsorTier",
  title: "Sponsor tier",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Tier name",
      type: "string",
      description: "For example Sponsor. The Sponsors page groups sponsors under this name.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "pricePerYear",
      title: "Price per year (dollars)",
      type: "number",
      description: "Optional. What the tier costs each year, in whole dollars, for example 500.",
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: "benefits",
      title: "Benefits",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      description: "What sponsors at this tier get, one benefit per line.",
    }),
    defineField({
      name: "logoPlacement",
      title: "Logo placement",
      type: "string",
      description: "How this tier's sponsors appear on the Sponsors page.",
      options: { list: optionList(LOGO_PLACEMENTS), layout: "radio" },
      initialValue: "logo",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sortOrder",
      title: "Order on the Sponsors page",
      type: "number",
      description: "Tiers with lower numbers show first. Use 1 for the top tier.",
      validation: (rule) => rule.integer().min(0),
    }),
  ],
  orderings: [{ title: "Order", name: "orderAsc", by: [{ field: "sortOrder", direction: "asc" }] }],
  preview: {
    select: { title: "name", price: "pricePerYear" },
    prepare: ({ title, price }: Record<string, unknown>) => ({
      title: typeof title === "string" && title ? title : "Unnamed tier",
      subtitle: typeof price === "number" ? `$${price} a year` : "",
    }),
  },
});
