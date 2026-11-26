"use client";

// Configuration for the Content Studio served at /studio (app/studio/[[...tool]]/page.tsx).
// "use client" because the Studio runs in the browser and this config holds functions.
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { dataset, projectId, studioBasePath } from "@/sanity/env";
import { schemaTypes } from "@/sanity/schemas";

export default defineConfig({
  name: "default",
  title: "Ozark Blues Society",
  basePath: studioBasePath,
  projectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [
    structureTool(),
    // Live preview: shows the site next to the editor, with drafts, through Next.js draft mode.
    presentationTool({
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
