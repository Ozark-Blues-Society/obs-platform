import { defineField, defineType } from "sanity";

/**
 * A place where events happen. Everything here is public: event pages, the calendar and its ICS
 * feed show it. Booking contacts and other directory details are members-only, so they live in
 * directoryEntry, never here (board-decisions §1, decision 0001, M-9).
 */
export const venue = defineType({
  name: "venue",
  title: "Venue",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "The venue's name, for example Old Mill Music Hall.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "address",
      title: "Address",
      type: "text",
      rows: 2,
      description:
        "Street address and town, shown on public event pages. Booking contacts don't go here: add them to the venue's Directory entry, which only members see.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "mapUrl",
      title: "Map link",
      type: "url",
      description: "Optional. A Google Maps or Apple Maps link to the venue, for directions.",
      validation: (rule) => rule.uri({ scheme: ["https"] }),
    }),
  ],
  preview: { select: { title: "name", subtitle: "address" } },
});
