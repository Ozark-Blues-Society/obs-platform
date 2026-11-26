import { expect, test, type Page, type TestInfo } from "@playwright/test";

// The layout shell (backlog D-2): landmarks, the skip link, the header's menu at both widths, and
// the account links. The menu has only its built-in links here: CI has no Sanity project.

const BUILT_IN_LINKS = [
  ["Events", "/events"],
  ["Blog", "/blog"],
  ["Sponsors", "/sponsors"],
  ["Donate", "/donate"],
];

const onPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("every page has a header, a main area and a footer", async ({ page }) => {
  for (const path of ["/", "/sign-in"]) {
    await page.goto(path);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("contentinfo").getByRole("navigation", { name: "Footer" }),
    ).toBeVisible();
  }
});

test("the skip link is the first stop and moves focus past the header", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // The next Tab starts after the header.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest("header") ?? null)).toBeNull();
});

test("on a computer, the menu and the account links sit in the header", async ({
  page,
}, testInfo) => {
  test.skip(onPhone(testInfo), "desktop layout");
  await page.goto("/");
  const header = page.getByRole("banner");

  const menu = header.getByRole("navigation", { name: "Main" });
  await expect(menu).toBeVisible();
  for (const [name, href] of BUILT_IN_LINKS) {
    await expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(header.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(header.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
});

test("on a phone, the Menu button opens the menu and Escape closes it", async ({
  page,
}, testInfo) => {
  test.skip(!onPhone(testInfo), "phone layout");
  await page.goto("/");
  const header = page.getByRole("banner");
  const menuButton = header.getByRole("button", { name: "Menu" });
  const menu = header.getByRole("navigation", { name: "Main" });

  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  // Open it from the keyboard.
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toBeVisible();
  for (const [name, href] of BUILT_IN_LINKS) {
    await expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  // At phone width the account links are in the menu too.
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Join" })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // Tab goes into the menu, Escape closes it and returns focus to the button.
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Events" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
  await expect(menuButton).toBeFocused();

  // A tap opens and closes it too.
  await menuButton.click();
  await expect(menu).toBeVisible();
  await menuButton.click();
  await expect(menu).toBeHidden();

  // Leaving by a link that isn't in the menu (Sign in) closes it, and coming back doesn't reopen it.
  await menuButton.click();
  await header.getByRole("link", { name: "Sign in" }).click();
  const signInForm = page.getByRole("region", { name: "Sign in with a password" });
  await expect(signInForm).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  // The URL changes before the page does: wait until the sign-in page is hidden again.
  await expect(signInForm).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
});

test("a signed-in member sees My Account instead of Sign in and Join", async ({
  page,
}, testInfo) => {
  // A fixture member (scripts/fixtures/members.mts) that no other test signs in as.
  const email = onPhone(testInfo) ? "pat.walsh@example.com" : "chris.price@example.com";
  await page.goto("/sign-in");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill("obs-local-dev");
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/");
  const header = page.getByRole("banner");
  if (onPhone(testInfo)) {
    await header.getByRole("button", { name: "Menu" }).click();
  }
  await expect(header.getByRole("link", { name: "My Account" })).toHaveAttribute(
    "href",
    "/account",
  );
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Join" })).toHaveCount(0);
});
