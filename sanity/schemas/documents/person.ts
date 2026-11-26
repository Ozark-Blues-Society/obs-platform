import { defineField, defineType } from "sanity";
import { imageField } from "../fields";

/** A board member, volunteer or team: the board list on the About page, and blog authors. */
export const person = defineType({
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "A person's name, or a team's, for example Communications Team.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description: "Optional, for example President, Treasurer or Volunteer coordinator.",
    }),
    imageField({
      name: "photo",
      title: "Photo",
      description: "Optional. A head-and-shoulders photo works best.",
      altDescription: "Usually the person's name, for example Dee Harmon.",
    }),
    defineField({
      name: "bio",
      title: "Short bio",
      type: "text",
      rows: 3,
      description: "Optional. A few sentences, shown with the board list and on their blog posts.",
    }),
    defineField({
      name: "boardMember",
      title: "On the board",
      type: "boolean",
      description: "Turn on to list this person on the About page's board list.",
      initialValue: false,
    }),
    defineField({
      name: "boardOrder",
      title: "Order on the board list",
      type: "number",
      description: "Lower numbers show first. Use 1 for the president.",
      hidden: ({ parent }) =>
        (parent as { boardMember?: boolean } | undefined)?.boardMember !== true,
      validation: (rule) => rule.integer().min(0),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "role", media: "photo" },
  },
});
