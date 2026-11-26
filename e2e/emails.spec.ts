import { expect, test } from "@playwright/test";
import ReceiptEmail from "../emails/receipt";
import { renderEmail } from "../emails/render";
import WelcomeEmail from "../emails/welcome";

// The emails (backlog E-1) aren't pages of the site, so these tests render each one with its
// sample props and load the HTML straight into the browser, at desktop and at phone width.
const emails = [
  { name: "welcome", render: () => renderEmail(WelcomeEmail, WelcomeEmail.PreviewProps) },
  { name: "receipt", render: () => renderEmail(ReceiptEmail, ReceiptEmail.PreviewProps) },
];

for (const email of emails) {
  test(`the ${email.name} email fits the screen`, async ({ page }) => {
    // An email loads nothing from anywhere; block requests so a test can't leave the machine.
    await page.route("**/*", (route) => route.abort());
    await page.setContent((await email.render()).html);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const button = page.getByRole("link", { name: "Go to My Account" });
    await expect(button).toBeVisible();

    // Nothing sticks out sideways: no horizontal scrolling at 390px.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const box = await button.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}
