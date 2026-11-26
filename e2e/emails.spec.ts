import { expect, test } from "@playwright/test";
import type { EmailTemplate } from "../emails/_lib/template";
import ListingApprovedEmail from "../emails/listing-approved";
import ListingExpiringEmail from "../emails/listing-expiring";
import ListingRejectedEmail from "../emails/listing-rejected";
import MembershipLapsedEmail from "../emails/membership-lapsed";
import ReceiptEmail from "../emails/receipt";
import { renderEmail } from "../emails/render";
import RenewalLastReminderEmail from "../emails/renewal-last-reminder";
import RenewalReminderEmail from "../emails/renewal-reminder";
import WelcomeEmail from "../emails/welcome";

// The emails (backlog E-1) aren't pages of the site, so these tests render each one with its
// sample props and load the HTML straight into the browser, at desktop and at phone width.
const sample =
  <Props extends object>(template: EmailTemplate<Props>) =>
  () =>
    renderEmail(template, template.PreviewProps);

const emails = [
  { name: "welcome", button: "Go to My Account", render: sample(WelcomeEmail) },
  { name: "receipt", button: "Go to My Account", render: sample(ReceiptEmail) },
  {
    name: "renewal reminder",
    button: "Renew your membership",
    render: sample(RenewalReminderEmail),
  },
  {
    name: "last renewal reminder",
    button: "Renew your membership",
    render: sample(RenewalLastReminderEmail),
  },
  { name: "lapsed", button: "Renew your membership", render: sample(MembershipLapsedEmail) },
  { name: "listing approved", button: "Go to My listings", render: sample(ListingApprovedEmail) },
  { name: "listing rejected", button: "Go to My listings", render: sample(ListingRejectedEmail) },
  { name: "listing expiring", button: "Renew your listing", render: sample(ListingExpiringEmail) },
];

for (const email of emails) {
  test(`the ${email.name} email fits the screen`, async ({ page }) => {
    // An email loads nothing from anywhere; block requests so a test can't leave the machine.
    await page.route("**/*", (route) => route.abort());
    await page.setContent((await email.render()).html);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const button = page.getByRole("link", { name: email.button });
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
