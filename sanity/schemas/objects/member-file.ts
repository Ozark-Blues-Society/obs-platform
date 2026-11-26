import { defineField, defineType } from "sanity";
import { memberFileCodeRule } from "../validation";

/**
 * A members-only file attached to a page, post or event (backlog M-7). The file itself is kept on
 * the website, in a private store, not in Sanity, which would make it public (decision 0001).
 * Editors upload it under Admin, then Members-only files, and paste its code here. Who can
 * download it is set there.
 */
export const memberFile = defineType({
  name: "memberFile",
  title: "Members-only file",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Link text",
      type: "string",
      description: "What the link says, for example: November board minutes (PDF).",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "fileId",
      title: "File code",
      type: "string",
      description:
        "The file's code from the website: Admin, then Members-only files, then Copy code next to the file. Who can download it was set there when it was uploaded.",
      validation: (rule) => rule.required().custom(memberFileCodeRule),
    }),
  ],
  preview: {
    select: { title: "title" },
    prepare: ({ title }: { title?: string }) => ({
      title: title || "Untitled file",
      subtitle: "🔒 Members-only file",
    }),
  },
});
