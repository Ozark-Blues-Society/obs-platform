import { expect, test } from "@playwright/test";
import { blockSanity, enterDraftMode } from "./support/sanity";

test("draft mode stays off without a preview secret that Sanity confirms", async ({ request }) => {
  for (const path of [
    "/api/draft-mode/enable",
    "/api/draft-mode/enable?sanity-preview-secret=a-guess&sanity-preview-pathname=%2F",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });

    // 401 for a wrong secret. 503 where no read token is set (as in CI): the secret can't be checked.
    expect([401, 503]).toContain(response.status());
    expect(response.headers()["set-cookie"] ?? "").not.toContain("__prerender_bypass");
  }
});

test("someone with a shared preview link sees a preview banner and can exit", async ({
  page,
  context,
  baseURL,
}) => {
  await enterDraftMode(context, baseURL!);
  await page.goto("/");

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

test("the Studio never shows the site's preview banner", async ({ page, context, baseURL }) => {
  // Editors using live preview have draft mode on in the same browser as the Studio.
  await blockSanity(page);
  await enterDraftMode(context, baseURL!);
  await page.goto("/studio");

  await expect(page.getByRole("dialog", { name: "Network error" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Preview" })).toHaveCount(0);
});
