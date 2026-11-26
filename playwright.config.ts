import { defineConfig, devices } from "@playwright/test";

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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // CI's runner has two CPUs; two workers take about a third off the run.
  workers: isCI ? 2 : undefined,
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
      // CI runs `pnpm build` first and tests the production server; locally the dev server is
      // reused.
      command: isCI ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: SANITY_STAND_IN_ENV,
    },
  ],
});
