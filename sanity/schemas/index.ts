import type { SchemaTypeDefinition } from "sanity";
import { directoryEntry } from "./documents/directory-entry";
import { event } from "./documents/event";
import { page } from "./documents/page";
import { person } from "./documents/person";
import { post } from "./documents/post";
import { siteSettings } from "./documents/site-settings";
import { sponsor } from "./documents/sponsor";
import { sponsorTier } from "./documents/sponsor-tier";
import { venue } from "./documents/venue";
import { link } from "./objects/link";
import { memberFile } from "./objects/member-file";
import { richText } from "./objects/rich-text";
import { visibility } from "./objects/visibility";
import { pageBlocks } from "./page-blocks";

// The content model (docs/spec/architecture.md, "Content (Sanity)"). Every field needs a
// plain-language description for volunteers: schemas.test.ts fails without one.

/** Document types: the things editors create, in the order the Studio lists them. */
export const documentTypes = [
  page,
  event,
  post,
  sponsor,
  sponsorTier,
  venue,
  directoryEntry,
  person,
  siteSettings,
];

export const schemaTypes: SchemaTypeDefinition[] = [
  ...documentTypes,
  visibility,
  link,
  memberFile,
  richText,
  ...pageBlocks,
];
