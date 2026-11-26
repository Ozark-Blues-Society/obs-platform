import { defineField, defineType } from "sanity";
import { AUDIENCES, MEMBERSHIP_LEVELS, optionList } from "../options";
import { visibilityLevelsRule } from "../validation";

/**
 * Who can see a page, post or event (decision 0001, option A: members-only content stays in the
 * private dataset, marked by this field). M-7 gates it on the server:
 * - everyone: anyone;
 * - members: an active membership (expires_at in the future), any level;
 * - levels: an active membership at one of `levels`. `levels` means nothing for the other two.
 * Draft mode (Studio previews and shared preview links) never counts as a membership.
 */
export const visibility = defineType({
  name: "visibility",
  title: "Who can see this?",
  type: "object",
  options: { collapsible: false },
  fields: [
    defineField({
      name: "audience",
      title: "Show to",
      type: "string",
      description:
        "Everyone: anyone on the internet. Members only: signed-in members whose membership hasn't expired, at any level. Only some levels: members at the levels you tick below.",
      options: { list: optionList(AUDIENCES), layout: "radio" },
      initialValue: "everyone",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "levels",
      title: "Membership levels",
      type: "array",
      of: [{ type: "string" }],
      description: "Tick every level that can see this.",
      options: { list: optionList(MEMBERSHIP_LEVELS), layout: "grid" },
      hidden: ({ parent }) => (parent as { audience?: string } | undefined)?.audience !== "levels",
      validation: (rule) => rule.unique().custom(visibilityLevelsRule),
    }),
  ],
});
