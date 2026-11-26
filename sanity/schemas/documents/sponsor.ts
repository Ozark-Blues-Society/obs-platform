import { defineField, defineType, type PreviewValue } from "sanity";
import { imageField } from "../fields";
import { featuredSponsorRule, spotlightTextRule } from "../validation";

export const sponsor = defineType({
  name: "sponsor",
  title: "Sponsor",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Business name",
      type: "string",
      description: "As the sponsor wants it shown, for example Riverbend Brewing Co.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "website",
      title: "Website",
      type: "url",
      description: "Optional. Where the logo links to.",
      validation: (rule) => rule.uri({ scheme: ["https", "http"] }),
    }),
    imageField({
      name: "logo",
      title: "Logo",
      description: "A logo on a plain or transparent background (PNG or SVG works best).",
      altDescription: "Usually the business name, for example Riverbend Brewing Co. logo.",
    }),
    defineField({
      name: "tier",
      title: "Sponsorship level",
      type: "reference",
      to: [{ type: "sponsorTier" }],
      description:
        "The sponsor's tier. Tiers, with their prices and benefits, are under Sponsor tiers.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "featured",
      title: "Featured sponsor",
      type: "boolean",
      description:
        "Shows this sponsor's spotlight on the home page and the Sponsors page. Only one sponsor can be featured at a time.",
      initialValue: false,
      validation: (rule) => rule.custom(featuredSponsorRule),
    }),
    defineField({
      name: "blurb",
      title: "Spotlight text",
      type: "text",
      rows: 3,
      description: "A few sentences about the sponsor, shown in the spotlight while it's featured.",
      validation: (rule) => rule.custom(spotlightTextRule),
    }),
    defineField({
      name: "endsAt",
      title: "Sponsorship ends",
      type: "date",
      description:
        "Optional. The last day of the sponsorship: the day after, the sponsor disappears from the website by itself.",
    }),
  ],
  preview: {
    select: { title: "name", tier: "tier.name", featured: "featured", media: "logo" },
    prepare: ({
      title,
      tier,
      featured,
      media,
    }: {
      title?: string;
      tier?: string;
      featured?: boolean;
      media?: PreviewValue["media"];
    }) => ({
      title: title || "Unnamed sponsor",
      subtitle: [tier ?? "", featured === true ? "★ Featured" : ""].filter(Boolean).join(" · "),
      media,
    }),
  },
});
