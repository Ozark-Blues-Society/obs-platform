import { defineField, defineType } from "sanity";

const BOOKING_ONLY = "Only Band, Business and Sponsor members see this.";

/**
 * A row in the members-only venue directory (the Directory page's table). All of it is for
 * signed-in members only. The booking contact is one object so that M-9 can leave it out of the
 * query for Individual members: never select it with `...` (board-decisions §1, decision 0001).
 */
export const directoryEntry = defineType({
  name: "directoryEntry",
  title: "Directory entry",
  type: "document",
  fields: [
    defineField({
      name: "venue",
      title: "Venue",
      type: "reference",
      to: [{ type: "venue" }],
      description:
        "The venue this row is about. Pick it, or create it here. Its name and address come from the venue.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "capacity",
      title: "Capacity",
      type: "string",
      description: "Members only. How many people it holds, for example 120, or Open air.",
    }),
    defineField({
      name: "pay",
      title: "How it pays",
      type: "string",
      description:
        "Members only. How the venue usually pays bands, for example Door split or guarantee.",
    }),
    defineField({
      name: "notes",
      title: "Notes",
      type: "text",
      rows: 2,
      description: "Members only. Anything else worth knowing, for example Sound tech provided.",
    }),
    defineField({
      name: "bookingContact",
      title: "Booking contact",
      type: "object",
      description: `Who books the music. ${BOOKING_ONLY} Individual members and visitors never do.`,
      options: { collapsible: false },
      fields: [
        defineField({
          name: "name",
          title: "Name",
          type: "string",
          description: `A person or a desk, for example Events desk. ${BOOKING_ONLY}`,
        }),
        defineField({
          name: "email",
          title: "Email",
          type: "email",
          description: BOOKING_ONLY,
        }),
        defineField({
          name: "phone",
          title: "Phone",
          type: "string",
          description: `For example (479) 555-0100. ${BOOKING_ONLY}`,
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "venue.name", capacity: "capacity", contact: "bookingContact.name" },
    prepare: ({ title, capacity, contact }: Record<string, string | undefined>) => ({
      title: title || "No venue chosen",
      subtitle: [capacity && `Capacity ${capacity}`, contact].filter(Boolean).join(" · "),
    }),
  },
});
