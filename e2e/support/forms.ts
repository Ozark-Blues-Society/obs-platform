import type { Page } from "@playwright/test";

/**
 * Holds the page's POST requests to `url` (a glob for the whole URL; a form's Server Function
 * posts to the page's own address) until the returned function is called, to see the form while
 * it's sending.
 */
export async function holdPosts(page: Page, url: string): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  return release;
}

/**
 * What a CSS system color (`GrayText`, `ButtonText`…) comes to in the page. In forced-colors mode
 * (Windows High Contrast), browsers draw a disabled button's text and border in GrayText.
 */
export async function systemColor(page: Page, name: string): Promise<string> {
  return page.evaluate((color) => {
    const probe = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}
