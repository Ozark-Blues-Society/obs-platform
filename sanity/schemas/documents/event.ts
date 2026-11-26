import { defineField, defineType, type PreviewValue } from "sanity";
import { imageField, slugField, societyDatetimeOptions, visibilityField } from "../fields";
import {
  EVENT_CATEGORIES,
  RECURRENCE_FREQUENCIES,
  SOCIETY_TIME_ZONE,
  optionList,
  optionTitle,
} from "../options";
import { recurrenceUntilRule } from "../validation";
import { eventPath } from "../../paths";

type Selection = {
  title?: string;
  start?: string;
  frequency?: string;
  audience?: string;
  media?: PreviewValue["media"];
};

export const event = defineType({
  name: "event",
  title: "Event",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description:
        "The event's name as the calendar shows it, for example Delta Night: Mavis Crane Band.",
      validation: (rule) => rule.required().max(100),
    }),
    slugField({ path: eventPath, example: "delta-night-mavis-crane-band" }),
    defineField({
      name: "start",
      title: "Date and start time",
      type: "datetime",
      description:
        "When it starts, in Central Time. For a repeating event, this is the first date.",
      options: societyDatetimeOptions,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "recurrence",
      title: "Repeats",
      type: "object",
      description: "Set it once and every date fills in on the calendar.",
      options: { collapsible: false },
      initialValue: { frequency: "none" },
      validation: (rule) => rule.required(),
      fields: [
        defineField({
          name: "frequency",
          title: "How often",
          type: "string",
          description:
            "Monthly keeps the first date's weekday and its place in the month: a first Friday repeats on first Fridays.",
          options: { list: optionList(RECURRENCE_FREQUENCIES), layout: "radio" },
          initialValue: "none",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "until",
          title: "Last date",
          type: "date",
          description: "The last day it repeats on. The calendar shows no dates after it.",
          hidden: ({ parent }) => {
            const frequency = (parent as { frequency?: string } | undefined)?.frequency;
            return !frequency || frequency === "none";
          },
          validation: (rule) => rule.custom(recurrenceUntilRule),
        }),
      ],
    }),
    defineField({
      name: "venue",
      title: "Venue",
      type: "reference",
      to: [{ type: "venue" }],
      description:
        "Pick the venue, or create it here: its address and map link are saved once and reused. Leave it empty for a private gathering whose address goes out by email.",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      description: "Visitors can filter the calendar by category.",
      options: { list: optionList(EVENT_CATEGORIES) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "priceText",
      title: "Price",
      type: "string",
      description: "What it costs, as visitors should read it: $15, Free, or $10 at the door.",
    }),
    defineField({
      name: "memberPrice",
      title: "Members' price",
      type: "string",
      description: "Optional, for example $10. Signed-in members see it highlighted.",
    }),
    visibilityField("event"),
    imageField({
      name: "image",
      title: "Photo",
      description:
        "Shown on the calendar, the event page and the home page. Drag the circle onto the important part so it crops well everywhere.",
    }),
    defineField({
      name: "body",
      title: "Description",
      type: "richText",
      description: "What people should know: who's playing, when doors open, what to bring.",
    }),
  ],
  orderings: [
    { title: "Date, latest first", name: "startDesc", by: [{ field: "start", direction: "desc" }] },
    { title: "Date, earliest first", name: "startAsc", by: [{ field: "start", direction: "asc" }] },
  ],
  preview: {
    select: {
      title: "title",
      start: "start",
      frequency: "recurrence.frequency",
      audience: "visibility.audience",
      media: "image",
    },
    prepare: ({ title, start, frequency, audience, media }: Selection) => {
      const date = start
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: SOCIETY_TIME_ZONE,
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date(start))
        : "No date yet";
      const repeats =
        frequency && frequency !== "none"
          ? optionTitle(RECURRENCE_FREQUENCIES, frequency).split(",")[0]
          : "";
      return {
        title: title || "Untitled event",
        subtitle: [date, repeats, audience && audience !== "everyone" ? "🔒 Members" : ""]
          .filter(Boolean)
          .join(" · "),
        media,
      };
    },
  },
});
