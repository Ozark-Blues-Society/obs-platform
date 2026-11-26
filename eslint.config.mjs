import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Members-only content (decision 0001, backlog M-7): the site reads pages, posts and events through
// sanity/content, which leaves out what the viewer may not see. Only the files listed in
// SANITY_CLIENT_FILES use the Sanity client directly. A test checks this rule (sanity/content/
// lint-guard.test.ts).
const SANITY_CLIENT_MESSAGE =
  "Read content through sanity/content: it leaves members-only content out for viewers who can't see it (decision 0001).";
const SANITY_CLIENT_NAMES = ["sanityFetch", "client"];
// Every way to write the path to sanity/live: "@/sanity/live", with or without an extension
// (tsconfig.json allows importing ".ts"), and any relative path ("./live", "../../live",
// "../sanity/live.ts").
const SANITY_LIVE_PATH = String.raw`^(?:\.{1,2}/|(?:.*/)?sanity/)(?:.*/)?live(?:\.[cm]?[jt]sx?)?$`;
const SANITY_CLIENT_FILES = [
  "sanity/live.ts",
  "sanity/content/**",
  // Menus and footer: page titles and links only, which are public.
  "sanity/site-chrome.ts",
  // Checks a preview secret with Sanity; reads no content.
  "app/api/draft-mode/enable/route.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Formatting is Prettier's job: turn off ESLint rules that conflict with it.
  prettier,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: [...SANITY_CLIENT_FILES, "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next-sanity", importNames: ["createClient"], message: SANITY_CLIENT_MESSAGE },
          ],
          patterns: [
            {
              regex: SANITY_LIVE_PATH,
              importNames: SANITY_CLIENT_NAMES,
              message: SANITY_CLIENT_MESSAGE,
            },
            // Its subpaths too: @sanity/client/stega exports createClient.
            { group: ["@sanity/client", "@sanity/client/*"], message: SANITY_CLIENT_MESSAGE },
          ],
        },
      ],
      // no-restricted-imports doesn't look at import(), which can't be checked by name: no
      // dynamic imports of these modules at all.
      "no-restricted-syntax": [
        "error",
        {
          selector: `ImportExpression[source.value=/${SANITY_LIVE_PATH.replaceAll("/", "\\/")}/i]`,
          message: SANITY_CLIENT_MESSAGE,
        },
        {
          selector: String.raw`ImportExpression[source.value=/^(?:next-sanity|@sanity\/client(?:\/.*)?)$/i]`,
          message: SANITY_CLIENT_MESSAGE,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test output:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    // Local agent and issue-tracker state. Agent worktrees in .claude/worktrees/
    // hold whole checkouts, and the patterns above only match at the repo root.
    ".beads/**",
    ".claude/**",
    ".gc/**",
  ]),
]);

export default eslintConfig;
