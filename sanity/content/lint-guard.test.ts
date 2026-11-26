// @vitest-environment node
// Proves the ESLint rule in eslint.config.mjs is wired up: outside sanity/content (and the few
// files listed there), code can't use the Sanity client, so it can't skip the members-only filter.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function restrictedImports(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

const CLIENT_IMPORTS = [
  'import { sanityFetch } from "@/sanity/live";',
  'import { client } from "@/sanity/live";',
  'import { createClient } from "next-sanity";',
  'import { createClient } from "@sanity/client";',
];

describe("the Sanity client import rule", () => {
  it("stops pages, components and other modules from using the Sanity client", async () => {
    const files = [
      "app/(site)/blog/[slug]/page.tsx",
      "app/api/events.ics/route.ts",
      "components/ui/post-card.tsx",
      "lib/site/sitemap.ts",
      "sanity/schemas/documents/post.ts",
    ];
    for (const filePath of files) {
      for (const code of CLIENT_IMPORTS) {
        const messages = await restrictedImports(code, filePath);
        expect(messages, `${code} in ${filePath}`).toHaveLength(1);
        expect(messages[0]).toContain("Read content through sanity/content");
      }
    }
    for (const code of [
      'import { sanityFetch } from "./live";',
      'import { client } from "../live";',
      'import { sanityFetch } from "../../sanity/live";',
    ]) {
      expect(await restrictedImports(code, "sanity/schemas/x.ts"), code).toHaveLength(1);
    }
  }, 60_000);

  it("lets the content module, the menus and the draft-mode route use it", async () => {
    const files = [
      "sanity/content/index.ts",
      "sanity/content/directory.ts",
      "sanity/site-chrome.ts",
      "sanity/live.ts",
      "app/api/draft-mode/enable/route.ts",
    ];
    for (const filePath of files) {
      for (const code of CLIENT_IMPORTS) {
        expect(await restrictedImports(code, filePath), `${code} in ${filePath}`).toEqual([]);
      }
    }
  }, 60_000);

  it("still lets any file use the rest of sanity/live and next-sanity", async () => {
    const code = [
      'import { SanityLive, getDynamicFetchOptions } from "@/sanity/live";',
      'import { defineQuery, stegaClean } from "next-sanity";',
    ].join("\n");
    expect(await restrictedImports(code, "app/(site)/layout.tsx")).toEqual([]);
  }, 60_000);
});
