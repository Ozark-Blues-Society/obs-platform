import { expect, test } from "@playwright/test";
import { blockSanity, openSharedPreviewLink } from "./support/sanity";

test("draft mode stays off without a preview secret that Sanity confirms", async ({ request }) => {
  for (const path of [
    "/api/draft-mode/enable",
    "/api/draft-mode/enable?sanity-preview-secret=a-guess&sanity-preview-pathname=%2F",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });

    // Playwright gives the server the stand-in's read token (playwright.config.ts), so the secret
    // is checked against the Studio's (e2e/fixtures/sanity-content.mts) and refused.
    expect(response.status()).toBe(401);
    expect(response.headers()["set-cookie"] ?? "").not.toContain("__prerender_bypass");
  }
});

test("someone with a shared preview link sees a preview banner and can exit", async ({
  page,
  context,
}) => {
  await openSharedPreviewLink(page, "/");

  const banner = page.getByRole("complementary", { name: "Preview" });
  await expect(banner).toContainText("unpublished changes");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await banner.getByRole("button", { name: "Exit preview" }).click();
  await expect(banner).toBeHidden();
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain(
    "__prerender_bypass",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner).toBeHidden();
});

test("the Studio never shows the site's preview banner", async ({ page }) => {
  // Editors using live preview have draft mode on in the same browser as the Studio.
  await blockSanity(page);
  await openSharedPreviewLink(page);
  await page.goto("/studio");

  await expect(page.getByRole("dialog", { name: "Network error" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Preview" })).toHaveCount(0);
});
