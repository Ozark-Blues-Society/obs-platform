import { expect, test } from "@playwright/test";
import { blockSanity } from "./support/sanity";

test.beforeEach(async ({ page }) => {
  await blockSanity(page);
});

test("the Content Studio loads at /studio and contacts the configured Sanity project", async ({
  page,
}) => {
  // The Studio's first call asks Sanity who is signed in to the project (placeholder in CI).
  const projectCall = page.waitForRequest(/^https:\/\/[a-z0-9-]+\.api\.sanity\.io\/.*\/users\/me/);
  await page.goto("/studio");
  await projectCall;

  await expect(page).toHaveTitle("Content Studio | Ozark Blues Society");
  // The Studio draws its own screen, not a blank or error page. Here it's the one for Sanity being
  // unreachable, since the test blocks Sanity. The Studio is a large app: on CI's two CPUs, with
  // two test workers, drawing it can take longer than the default 5 s.
  await expect(page.getByRole("dialog", { name: "Network error" })).toBeVisible({
    timeout: 15_000,
  });
});

test("search engines are asked not to index the Studio", async ({ page }) => {
  await page.goto("/studio");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});
