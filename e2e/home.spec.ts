import { expect, test } from "@playwright/test";
import { blockSanity } from "./support/sanity";

// The home page's sponsor band shows logos from Sanity's image CDN (backlog P-4): keep those
// requests on the machine.
test.beforeEach(async ({ page }) => {
  await blockSanity(page);
});

test("home page renders its heading and title", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Ozark Blues Society/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
});

test("home page fits the viewport without horizontal scrolling", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
