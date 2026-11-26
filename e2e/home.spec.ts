import { expect, test } from "@playwright/test";

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
