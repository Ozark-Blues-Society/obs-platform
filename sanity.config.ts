"use client";

// Configuration for the Content Studio served at /studio (app/studio/[[...tool]]/page.tsx).
// "use client" because the Studio runs in the browser and this config holds functions.
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { dataset, projectId, studioBasePath } from "@/sanity/env";
import { resolve } from "@/sanity/presentation";
import { schemaTypes } from "@/sanity/schemas";
import { structure } from "@/sanity/structure";

/**
 * Actions a singleton never offers: the site needs exactly one published Site settings.
 * unpublishVersion is "unpublish when the release publishes", for a document in a content release.
 */
const SINGLETON_HIDDEN_ACTIONS = ["delete", "duplicate", "unpublish", "unpublishVersion"];

export default defineConfig({
  name: "default",
  title: "Ozark Blues Society",
  basePath: studioBasePath,
  projectId,
  dataset,
  schema: { types: schemaTypes },
  document: {
    // One Site settings document, with the ID "siteSettings". Sanity then hides the type from
    // "create new" menus.
    singletons: ["siteSettings"],
    actions: (actions, context) =>
      context.singleton
        ? actions.filter(({ action }) => !action || !SINGLETON_HIDDEN_ACTIONS.includes(action))
        : actions,
  },
  plugins: [
    structureTool({ structure }),
    // Live preview: shows the site next to the editor, with drafts, through Next.js draft mode.
    presentationTool({
      resolve,
      previewUrl: {
        previewMode: {
          enable: "/api/draft-mode/enable",
          // Lets editors turn on "Share preview access" and send a link to someone without a
          // Studio login. Turning sharing off and on again makes old links stop working.
          shareAccess: true,
        },
      },
    }),
  ],
});
