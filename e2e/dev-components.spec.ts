import { expect, test, type Page } from "@playwright/test";

// The component gallery (backlog D-3) exists in development only. CI tests the production build
// (CI=1 runs `pnpm start`), which must answer 404; locally Playwright runs the dev server, where
// the gallery checks the components in a real browser.
const productionServer = !!process.env.CI;

const SECTIONS = [
  "Button",
  "Card",
  "Tag",
  "Pill filters",
  "Table",
  "Form fields",
  "Modal",
  "Toast",
  "Lock overlay",
  "Event card",
  "Post card",
  "Sponsor logo",
];

test("a production build doesn't serve the component gallery", async ({ request }) => {
  test.skip(!productionServer, "runs against the production server (CI=1)");
  const response = await request.get("/dev/components");
  expect(response.status()).toBe(404);
});

test.describe("the component gallery in development", () => {
  test.skip(productionServer, "the gallery exists only in development");

  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/components");
  });

  test("shows every component and fits the screen", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Components" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(SECTIONS);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the modal keeps focus inside, closes on Escape and returns focus", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Open a modal" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Post a listing" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Title" })).toBeFocused();

    // Title, Photo, Submit, Cancel, then round to the × button and back to Title.
    const focusedName = () => focusedInDialog(page);
    for (const expected of ["Photo (optional)", "Submit for review", "Cancel", "Close", "Title"]) {
      await page.keyboard.press("Tab");
      expect(await focusedName()).toBe(expected);
    }
    for (const expected of ["Close", "Cancel"]) {
      await page.keyboard.press("Shift+Tab");
      expect(await focusedName()).toBe(expected);
    }

    // The page behind can't be clicked while the modal is open: the dialog's backdrop is on top.
    const box = await trigger.boundingBox();
    const dialogOnTop = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("dialog") != null,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(dialogOnTop).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a toast appears in the live region and goes away", async ({ page }) => {
    await page.getByRole("button", { name: "Show a toast" }).click();
    const region = page.getByRole("status").filter({ hasText: "Preview link copied." });
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toBeHidden({ timeout: 8000 });
  });

  test("pill filters say which one is selected", async ({ page }) => {
    const group = page.getByRole("group", { name: "Event category" });
    await expect(group.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await group.getByRole("button", { name: "Jam" }).click();
    await expect(group.getByRole("button", { name: "Jam" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(group.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

/** The accessible name of the focused element, or "outside" if focus left the open dialog. */
function focusedInDialog(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active?.closest("dialog[open]")) return "outside";
    const labelled = active.getAttribute("aria-label");
    if (labelled) return labelled;
    const label = active.id && document.querySelector(`label[for="${active.id}"]`);
    return (label ? label.textContent : active.textContent)?.trim();
  });
}
