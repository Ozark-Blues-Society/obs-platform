import { expect, test, type Page } from "@playwright/test";

// The Design Approval package (backlog D-4): the home page and the four templates with sample
// content at /design-preview, checked at phone and desktop widths (the two projects).

const PAGES = [
  ["/design-preview", "Design preview"],
  ["/design-preview/home", "Live music, local players, and the people who keep the blues alive."],
  ["/design-preview/standard", "About the Society"],
  ["/design-preview/directory", "Venue & Booking Directory"],
  ["/design-preview/directory/individual", "Venue & Booking Directory"],
  ["/design-preview/directory/visitor", "Venue & Booking Directory"],
  ["/design-preview/band-spotlight", "The Muddy Ridge Trio"],
  ["/design-preview/promo-feature", "Blues Challenge 2027: Bands Wanted"],
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const [path, title] of PAGES) {
  test(`${path} renders in the site's layout, fits the screen and isn't indexed`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(main.getByRole("navigation", { name: "Design preview" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test("the preview links lead from the overview to every page and back", async ({ page }) => {
  await page.goto("/design-preview");
  const bar = page.getByRole("navigation", { name: "Design preview" });

  for (const [label, heading] of [
    ["Home", PAGES[1][1]],
    ["Standard", PAGES[2][1]],
    ["Directory", PAGES[3][1]],
    ["Band Spotlight", PAGES[6][1]],
    ["Promo Feature", PAGES[7][1]],
    ["Overview", PAGES[0][1]],
  ]) {
    await bar.getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(bar.getByRole("link", { name: label, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

test("the directory's search keeps the venues that match", async ({ page }) => {
  await page.goto("/design-preview/directory");
  const table = page.getByRole("table", { name: "Venues" });
  await expect(table.getByRole("row")).toHaveCount(6);

  await page.getByRole("searchbox", { name: "Search the directory" }).fill("tap");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("rowheader")).toHaveText("The Riverside Tap");
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Showing 1 of 5");

  await page.getByRole("searchbox", { name: "Search the directory" }).fill("");
  await expect(table.getByRole("row")).toHaveCount(6);
});

test("booking contacts reach Band members and up only; visitors get none of the directory", async ({
  page,
}) => {
  await page.goto("/design-preview/directory");
  await expect(page.getByRole("cell", { name: "Casey Dunn · 555-0142" })).toBeVisible();

  // The sample pages leave out what each viewer may not see, so it isn't in the HTML or in the
  // data the page hydrates from either.
  const individual = await page.request.get("/design-preview/directory/individual");
  const individualHtml = await individual.text();
  expect(individualHtml).toContain("Old Mill Music Hall");
  expect(individualHtml).not.toContain("555-0142");
  expect(individualHtml).not.toContain("booking@example.com");

  const visitor = await page.request.get("/design-preview/directory/visitor");
  const visitorHtml = await visitor.text();
  expect(visitorHtml).not.toContain("Old Mill Music Hall");
  expect(visitorHtml).not.toContain("555-0142");

  await page.goto("/design-preview/directory/visitor");
  await expect(page.getByRole("heading", { name: "This page is for members" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
