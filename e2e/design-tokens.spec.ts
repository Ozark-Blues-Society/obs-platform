import { expect, test } from "@playwright/test";

// Backlog D-1: the fonts come from this site (next/font), and the page is styled by the design
// tokens in app/globals.css.
test("fonts are self-hosted and the page uses the design tokens", async ({ page, baseURL }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") fontRequests.push(request.url());
  });

  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const loadedFamilies = await page.evaluate(() =>
    [...document.fonts]
      .filter((font) => font.status === "loaded")
      .map((font) => font.family.replaceAll('"', "")),
  );
  expect(loadedFamilies).toEqual(expect.arrayContaining(["Inter", "DM Serif Display"]));
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
  }

  // The browser resolves a token to the same rgb() string as the computed style.
  const token = (name: string) =>
    page.evaluate((color) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--color-${color})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, name);

  const body = await page.locator("body").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, font: style.fontFamily };
  });
  expect(body.background).toBe(await token("canvas"));
  expect(body.color).toBe(await token("ink"));
  expect(body.font).toMatch(/^"?Inter"?,/);

  const heading = page.getByRole("heading", { level: 1 });
  expect(await heading.evaluate((element) => getComputedStyle(element).fontFamily)).toMatch(
    /^"?DM Serif Display"?,/,
  );
});
