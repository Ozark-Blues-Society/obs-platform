// @vitest-environment node
// Proves the process.env rule in eslint.config.mjs is wired up: the app reads environment
// variables through lib/env, which checks them and keeps the server-only ones out of browser code.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function envReads(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-properties")
    .map((message) => message.message);
}

const READS = [
  "export const key = process.env.SUPABASE_SECRET_KEY;",
  'export const key = process.env["RESEND_API_KEY"];',
  "export const { CRON_SECRET } = process.env;",
  "export function settings(env = process.env) { return env; }",
];

describe("the process.env rule", () => {
  it("stops the app's code from reading environment variables itself", async () => {
    const files = [
      "app/api/cron/daily/route.ts",
      "app/(site)/page.tsx",
      "components/ui/button.tsx",
      "lib/email/send.ts",
      "sanity/live.ts",
      "sanity.config.ts",
      "proxy.ts",
    ];
    for (const filePath of files) {
      for (const code of READS) {
        const messages = await envReads(code, filePath);
        expect(messages, `${code} in ${filePath}`).toHaveLength(1);
        expect(messages[0]).toContain("Read environment variables through lib/env");
      }
    }
  });

  it("lets lib/env, configuration, scripts, the Netlify Function and tests read them", async () => {
    const files = [
      "lib/env/server.ts",
      "next.config.ts",
      "playwright.config.ts",
      "scripts/sanity/check-private-dataset.mts",
      "netlify/functions/daily-jobs.mts",
      "e2e/support/mailpit.ts",
      "lib/email/send.test.ts",
    ];
    for (const filePath of files) {
      expect(await envReads(READS[0], filePath), filePath).toEqual([]);
    }
  });
});
