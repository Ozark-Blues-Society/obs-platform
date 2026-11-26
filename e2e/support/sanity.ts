import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";

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
 * Turns on Next.js draft mode by setting its cookie. In real use /api/draft-mode/enable sets it,
 * after Sanity confirms the preview secret, which needs a Sanity project. `next build` writes the
 * cookie's value to .next/prerender-manifest.json; the dev server accepts any value.
 */
export async function enterDraftMode(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "__prerender_bypass",
      value: readPreviewModeId() ?? "development-id",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function readPreviewModeId(): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
    const id: unknown = manifest?.preview?.previewModeId;
    return typeof id === "string" && id ? id : undefined;
  } catch {
    return undefined;
  }
}
