// Field definitions that several document types share.
import { defineField } from "sanity";
import { SOCIETY_TIME_ZONE } from "./options";
import { imageAltRule, slugRule } from "./validation";

/** An image with a focal point (hotspot) and required alt text. */
export function imageField(options: {
  name: string;
  title: string;
  description: string;
  altDescription?: string;
  required?: boolean;
}) {
  return defineField({
    name: options.name,
    title: options.title,
    type: "image",
    description: options.description,
    options: { hotspot: true },
    fields: [
      defineField({
        name: "alt",
        title: "Alt text",
        type: "string",
        description:
          options.altDescription ??
          "Describe the image for people who can't see it, for example: Band performing on stage under warm lights.",
        validation: (rule) => rule.custom(imageAltRule),
      }),
    ],
    validation: options.required ? (rule) => rule.required() : undefined,
  });
}

/**
 * The end of a document's web address, made from its title. Sanity's slug type rejects one that
 * another document of the same type already uses.
 */
export function slugField(options: {
  /** Where a document with this slug lives on the site (sanity/paths.ts). */
  path: (slug: string) => string;
  example: string;
  reserved?: readonly string[];
}) {
  return defineField({
    name: "slug",
    title: "Web address",
    type: "slug",
    description: `The last part of the web address, for example ${options.path(options.example)}. Press Generate to make it from the title. Changing it later breaks links people have saved.`,
    options: { source: "title", maxLength: 96 },
    validation: (rule) => rule.required().custom(slugRule(options.reserved)),
  });
}

/** A date and time entered and shown in Central Time, whatever the editor's computer says. */
export const societyDatetimeOptions = {
  displayTimeZone: SOCIETY_TIME_ZONE,
  allowTimeZoneSwitch: false,
  timeStep: 15,
};

/** Who can see a page, post or event (sanity/schemas/objects/visibility.ts). */
export function visibilityField(thing: "page" | "post" | "event") {
  const visitorsSee = {
    page: "Visitors who can't see it get a sign-in or join prompt instead.",
    post: "Visitors who can't read it see the headline and a join-to-read prompt, not the summary or the post.",
    event: "Visitors who can't see it get the title and date, but not the place or details.",
  }[thing];
  return defineField({
    name: "visibility",
    title: `Who can see this ${thing}?`,
    type: "visibility",
    description: `${visitorsSee} Share-preview links never unlock it.`,
    initialValue: { audience: "everyone" },
    validation: (rule) => rule.required(),
  });
}

/**
 * Members-only files attached to a page, post or event (sanity/schemas/objects/member-file.ts). The
 * site lists them as links to /files/<code>, which checks the member before the download starts.
 */
export function memberFilesField(thing: "page" | "post" | "event") {
  return defineField({
    name: "memberFiles",
    title: "Members-only files",
    type: "array",
    of: [{ type: "memberFile" }],
    description: `Optional. Files only members can download from this ${thing}, such as minutes or a booking guide. Upload each one on the website first (Admin, then Members-only files), then add it here with its code. Never upload a private file to the Studio: anyone with its address could open it.`,
  });
}
