import { defineField, defineType } from "sanity";
import { hrefRule, linkRule } from "../validation";

/** Where a button or menu link goes: something in the Studio, or a web address. */
export const link = defineType({
  name: "link",
  title: "Link",
  type: "object",
  options: { collapsible: false },
  fields: [
    defineField({
      name: "internal",
      title: "A page, post or event",
      type: "reference",
      to: [{ type: "page" }, { type: "post" }, { type: "event" }],
      description:
        "Pick something from the Studio. The link keeps working if its web address changes.",
    }),
    defineField({
      name: "href",
      title: "Or a web address",
      type: "string",
      description:
        "For anything else: a part of this site such as /events or /join, another website (https://…), or an email address (mailto:name@example.com).",
      validation: (rule) => rule.custom(hrefRule),
    }),
  ],
  validation: (rule) => rule.custom(linkRule),
});
