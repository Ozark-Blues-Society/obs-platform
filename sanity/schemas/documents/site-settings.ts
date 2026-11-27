import { defineArrayMember, defineField, defineType } from "sanity";
import {
  MEMBERSHIP_LEVELS,
  MENU_PLACEMENTS,
  SOCIAL_PLATFORMS,
  optionList,
  optionTitle,
  type MembershipLevel,
} from "../options";
import { hrefRule } from "../validation";

const ALL_LEVELS: MembershipLevel[] = MEMBERSHIP_LEVELS.map((level) => level.value);
const BAND_AND_UP: MembershipLevel[] = ["band", "business", "sponsor"];

/**
 * The benefits table from docs/spec/board-decisions.md §1, used as the starting value when the
 * Site settings document is first created. After that, editors keep it up to date in the Studio.
 */
export const BOARD_BENEFITS = (
  [
    { _key: "classifieds", benefit: "Post in the classifieds", levels: ALL_LEVELS },
    {
      _key: "calendar",
      benefit: "Event calendar, including members-only events",
      levels: ALL_LEVELS,
    },
    {
      _key: "sponsor-discount",
      benefit: "10% off paid Society events and other paid items",
      levels: ["sponsor"],
    },
    { _key: "newsletter", benefit: "Monthly newsletter", levels: ALL_LEVELS },
    {
      _key: "drawings",
      benefit: "Eligible for VIP drawings, All Access passes and giveaways",
      levels: ALL_LEVELS,
    },
    { _key: "merch", benefit: "15% off Society merchandise (not bulk)", levels: ALL_LEVELS },
    { _key: "directory", benefit: "Venue directory: venue names and details", levels: ALL_LEVELS },
    { _key: "booking-contacts", benefit: "Venue directory: booking contacts", levels: BAND_AND_UP },
    { _key: "gigs", benefit: "Post gigs on the Event Calendar", levels: BAND_AND_UP },
    {
      _key: "presales",
      benefit: "Ticket pre-sales and early entry (General Admission)",
      levels: ["business", "sponsor"],
    },
    { _key: "spotlight", benefit: "Sponsor Spotlight highlight", levels: ["sponsor"] },
  ] satisfies { _key: string; benefit: string; levels: MembershipLevel[] }[]
).map((row) => ({ _type: "benefit" as const, ...row }));

/** One document (a singleton, see sanity.config.ts) for settings used across the whole site. */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  groups: [
    { name: "footer", title: "Footer", default: true },
    { name: "social", title: "Social links" },
    { name: "membership", title: "Membership benefits" },
    { name: "perks", title: "Member perks" },
    { name: "menus", title: "Menus" },
  ],
  fields: [
    defineField({
      name: "footerText",
      title: "About the Society",
      type: "text",
      rows: 2,
      group: "footer",
      description:
        "A sentence about the Society for the footer, for example A community nonprofit.",
    }),
    defineField({
      name: "mailingAddress",
      title: "Mailing address",
      type: "text",
      rows: 3,
      group: "footer",
      description: "Shown in the footer of every page.",
    }),
    defineField({
      name: "email",
      title: "Contact email",
      type: "email",
      group: "footer",
      description: "The Society's public email address, shown in the footer.",
    }),
    defineField({
      name: "phone",
      title: "Contact phone",
      type: "string",
      group: "footer",
      description: "Optional. A public phone number for the footer.",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      group: "social",
      description: "The Society's social media pages, shown in the footer in this order.",
      of: [
        defineArrayMember({
          name: "socialLink",
          title: "Social link",
          type: "object",
          fields: [
            defineField({
              name: "platform",
              title: "Platform",
              type: "string",
              description: "Which site the link goes to.",
              options: { list: optionList(SOCIAL_PLATFORMS) },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "url",
              title: "Link",
              type: "url",
              description: "The full address of the Society's page, starting with https://.",
              validation: (rule) => rule.required().uri({ scheme: ["https"] }),
            }),
          ],
          preview: {
            select: { platform: "platform", url: "url" },
            prepare: ({ platform, url }: Record<string, string | undefined>) => ({
              title: optionTitle(SOCIAL_PLATFORMS, platform) || "Social link",
              subtitle: url,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: "membershipBenefits",
      title: "Membership benefits",
      type: "array",
      group: "membership",
      description:
        "The benefits table on the Membership Benefits & Join page, one row per benefit. Prices come from the payment system, not from here.",
      of: [
        defineArrayMember({
          name: "benefit",
          title: "Benefit",
          type: "object",
          fields: [
            defineField({
              name: "benefit",
              title: "Benefit",
              type: "string",
              description: "What members get, in a few words, for example Monthly newsletter.",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "levels",
              title: "Levels that get it",
              type: "array",
              of: [defineArrayMember({ type: "string" })],
              description: "Tick every membership level that gets this benefit.",
              options: { list: optionList(MEMBERSHIP_LEVELS), layout: "grid" },
              validation: (rule) => rule.required().min(1).unique(),
            }),
          ],
          preview: {
            select: { title: "benefit", levels: "levels" },
            prepare: ({ title, levels }: { title?: string; levels?: string[] }) => ({
              title: title || "New benefit",
              subtitle: (levels ?? [])
                .map((level) => optionTitle(MEMBERSHIP_LEVELS, level))
                .join(", "),
            }),
          },
        }),
      ],
    }),
    // Members-only (board-decisions §1, §5 and §6): sanity/content/member-perks.ts reads these for
    // My Account, for members with an active membership at the levels ticked, and nothing else
    // reads them. Other queries of Site settings list the fields they read.
    defineField({
      name: "perkCodes",
      title: "Member perk codes",
      type: "array",
      group: "perks",
      description:
        "Codes members use for their perks, such as the merchandise discount. Members only: each code shows on My Account to members at the levels ticked, while their membership is active, and nowhere else on the site.",
      of: [
        defineArrayMember({
          name: "perkCode",
          title: "Perk code",
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Name",
              type: "string",
              description: "What the code is, for example Member discount code.",
              validation: (rule) => rule.required().max(60),
            }),
            defineField({
              name: "code",
              title: "Code",
              type: "string",
              description: "The code itself, as members show or type it, for example BLUES-MBR-26.",
              validation: (rule) => rule.required().max(40),
            }),
            defineField({
              name: "details",
              title: "How to use it",
              type: "text",
              rows: 2,
              description:
                "Optional. Where the code works and what it gets, for example 15% off Society merchandise at the merch table (not bulk orders).",
              validation: (rule) => rule.max(300),
            }),
            defineField({
              name: "levels",
              title: "Levels that get it",
              type: "array",
              of: [defineArrayMember({ type: "string" })],
              description: "Tick every membership level that gets this code.",
              options: { list: optionList(MEMBERSHIP_LEVELS), layout: "grid" },
              validation: (rule) => rule.required().min(1).unique(),
            }),
          ],
          preview: {
            select: { title: "label", code: "code", levels: "levels" },
            prepare: ({
              title,
              code,
              levels,
            }: {
              title?: string;
              code?: string;
              levels?: string[];
            }) => ({
              title: title || "New perk code",
              subtitle: [
                code,
                (levels ?? []).map((level) => optionTitle(MEMBERSHIP_LEVELS, level)).join(", "),
              ]
                .filter(Boolean)
                .join(" · "),
            }),
          },
        }),
      ],
    }),
    defineField({
      name: "menuLinks",
      title: "Other menu links",
      type: "array",
      group: "menus",
      description:
        "Menu links to things that aren't pages in the Studio, such as another website. Pages add themselves to menus with their own Show in menu setting.",
      of: [
        defineArrayMember({
          name: "menuLink",
          title: "Menu link",
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              description: "The words in the menu.",
              validation: (rule) => rule.required().max(30),
            }),
            defineField({
              name: "href",
              title: "Goes to",
              type: "string",
              description: "A web address (https://…) or a part of this site, such as /events.",
              validation: (rule) => rule.required().custom(hrefRule),
            }),
            defineField({
              name: "placement",
              title: "Menu",
              type: "string",
              description: "Which menu the link goes in.",
              options: {
                list: optionList(MENU_PLACEMENTS.filter(({ value }) => value !== "none")),
              },
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: "label", placement: "placement" },
            prepare: ({ title, placement }: Record<string, string | undefined>) => ({
              title: title || "New link",
              subtitle: optionTitle(MENU_PLACEMENTS, placement),
            }),
          },
        }),
      ],
    }),
  ],
  initialValue: { membershipBenefits: BOARD_BENEFITS },
  preview: { prepare: () => ({ title: "Site settings" }) },
});
