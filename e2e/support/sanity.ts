import { expect, type Page } from "@playwright/test";
import { SHARED_PREVIEW_SECRET } from "../fixtures/sanity-content.mts";

/**
 * Keeps Sanity's servers out of a test: requests to them fail at once, as if offline. CI has no
 * Sanity project, so the Studio then shows its own "can't reach Sanity" screen.
 */
export async function blockSanity(page: Page) {
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(sanity\.io|sanity-cdn\.com)\//, (route) =>
    route.abort(),
  );
}

/**
 * Opens a shared preview link to `path`, as someone it was sent to would: /api/draft-mode/enable
 * checks the link's secret with Sanity (here the e2e stand-in), turns on draft mode and redirects to
 * the page. The server sets the draft-mode cookie itself, because its value must be the running
 * server's preview ID: `next start` uses the build's, and `next dev` makes a new one each time it
 * starts.
 */
export async function openSharedPreviewLink(page: Page, path = "/") {
  const link = `/api/draft-mode/enable?${new URLSearchParams({
    "sanity-preview-secret": SHARED_PREVIEW_SECRET,
    "sanity-preview-pathname": path,
  })}`;
  const response = await page.goto(link);
  expect(response?.status(), `opening the shared preview link to ${path}`).toBe(200);
  await expect(page).toHaveURL(path);
}
