import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";
import { FAKE_API_KEY } from "./lib/mailerlite/fake-api";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

// Content comes from a local stand-in for Sanity (e2e/support/sanity-stand-in.mts), never from
// Sanity itself: CI has no Sanity project, and tests must never touch a real one. The app finds the
// stand-in through these variables, which override any in .env.local. CI's build step sets the same
// values (.github/workflows/ci.yml), because Next.js reads NEXT_PUBLIC_SANITY_PROJECT_ID when it
// builds. The token is a made-up one the stand-in checks, to act like a private dataset.
const STAND_IN_PORT = Number(process.env.SANITY_STAND_IN_PORT ?? PORT + 400);
const SANITY_STAND_IN_ENV = {
  NEXT_PUBLIC_SANITY_PROJECT_ID: "e2estandin",
  SANITY_API_HOST_STAND_IN: `http://127.0.0.1:${STAND_IN_PORT}`,
  SANITY_API_READ_TOKEN: "e2e-stand-in-token",
};

// MailerLite is a local stand-in too (e2e/support/mailerlite-stand-in.mts), never MailerLite: tests
// must never reach a real account. With its made-up key, the app shows the blog's newsletter signup
// box and the email switches on My Account, and the server code that syncs member groups after a
// change talks to the stand-in. These are server-only values, read at request time, so CI's build
// doesn't need them.
const MAILERLITE_STAND_IN_PORT = Number(process.env.MAILERLITE_STAND_IN_PORT ?? PORT + 500);
const MAILERLITE_ENV = {
  MAILERLITE_API_KEY: FAKE_API_KEY,
  MAILERLITE_API_URL_STAND_IN: `http://127.0.0.1:${MAILERLITE_STAND_IN_PORT}`,
};

/**
 * The local stack's service role key, which the app server needs to email posters from the
 * moderation queue (backlog K-2): SUPABASE_SECRET_KEY, or what `supabase status` prints. Left in
 * process.env, so the test workers, which load this file again, don't ask again. Undefined when no
 * stack is running; the tests that need one fail on their own then.
 */
function localSecretKey(): string | undefined {
  if (!process.env.SUPABASE_SECRET_KEY) {
    try {
      const status = JSON.parse(
        execFileSync("supabase", ["status", "--output", "json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      ) as { SECRET_KEY?: string };
      if (status.SECRET_KEY) process.env.SUPABASE_SECRET_KEY = status.SECRET_KEY;
    } catch {
      // No stack, or no Supabase CLI.
    }
  }
  return process.env.SUPABASE_SECRET_KEY;
}

// The app's own emails (lib/email/send.ts) go to the local stack's Mailpit, never through Resend,
// whatever .env.local says: an empty RESEND_API_KEY here wins over it.
const SECRET_KEY = localSecretKey();
const EMAIL_ENV = {
  EMAIL_FROM: "onboarding@resend.dev",
  MAILPIT_URL: process.env.MAILPIT_URL ?? "http://127.0.0.1:54324",
  RESEND_API_KEY: "",
  ...(SECRET_KEY ? { SUPABASE_SECRET_KEY: SECRET_KEY } : {}),
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phone width from the Definition of done (390px), run in Chromium.
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: [
    {
      command:
        "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/support/sanity-stand-in.mts",
      url: `http://127.0.0.1:${STAND_IN_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 20_000,
      env: { SANITY_STAND_IN_PORT: String(STAND_IN_PORT), ...SANITY_STAND_IN_ENV },
    },
    {
      command:
        "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/support/mailerlite-stand-in.mts",
      url: `${MAILERLITE_ENV.MAILERLITE_API_URL_STAND_IN}/health`,
      reuseExistingServer: !isCI,
      timeout: 20_000,
      env: { MAILERLITE_STAND_IN_PORT: String(MAILERLITE_STAND_IN_PORT) },
    },
    {
      // CI runs `pnpm build` first and tests the production server; locally the dev server is
      // reused.
      command: isCI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      // SITE_URL: the site's own address, which links in the monthly newsletter and the emails
      // start with. CI has no .env.local to set it.
      env: { ...SANITY_STAND_IN_ENV, ...MAILERLITE_ENV, ...EMAIL_ENV, SITE_URL: baseURL },
    },
  ],
});
