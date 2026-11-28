import { randomBytes } from "node:crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { SIGNUP_MESSAGES } from "../lib/newsletter/signup-state";
import { failStandInOnce, putStandInSubscriber, standInSubscriber } from "./support/mailerlite";

// The newsletter signup box at the end of the blog (decision 0015), against the MailerLite stand-in
// (e2e/support/mailerlite-stand-in.mts), whose account uses double opt-in. Each test signs up its
// own address, with the browser project's name in it, so the desktop and phone (390px) runs never
// share one.

const addressFor = (testInfo: TestInfo, name: string) =>
  `newsletter-signup.${testInfo.project.name}.${name}.${randomBytes(4).toString("hex")}@example.com`;

const signupBox = (page: Page) => page.getByRole("region", { name: "Get the blog in your inbox" });

/** The page fits the screen: nothing makes it scroll sideways (the phone project is 390px). */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "pixels the page is wider than the screen").toBeLessThanOrEqual(0);
}

test("a visitor signs up at the end of the blog, and MailerLite asks them to confirm", async ({
  page,
  request,
}, testInfo) => {
  const email = addressFor(testInfo, "new");
  await page.goto("/blog");

  const box = signupBox(page);
  await expect(box).toContainText(
    "A monthly digest of new posts and upcoming shows. Members get it automatically.",
  );
  await expectNoSidewaysScroll(page);
  // From the keyboard: type the address and press Enter.
  await box.getByLabel("Email address").fill(email);
  await box.getByLabel("Email address").press("Enter");

  await expect(box.getByRole("status")).toHaveText(SIGNUP_MESSAGES.done);
  await expect(box.getByLabel("Email address")).toHaveValue("");
  expect(await standInSubscriber(request, email)).toEqual({
    status: "unconfirmed",
    groups: ["Newsletter"],
    confirmationEmails: 1,
  });
  await expectNoSidewaysScroll(page);
});

test("the box says what's wrong with an address, on the field", async ({ page }) => {
  await page.goto("/blog");
  const box = signupBox(page);
  const field = box.getByLabel("Email address");

  await box.getByRole("button", { name: "Subscribe" }).click();
  await expect(box.getByRole("alert")).toHaveText(SIGNUP_MESSAGES.emailMissing);

  await field.fill("ada.quinn@example");
  await box.getByRole("button", { name: "Subscribe" }).click();
  await expect(box.getByRole("alert")).toHaveText(SIGNUP_MESSAGES.emailInvalid);
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("ada.quinn@example");
  await expect(box.getByRole("status")).toBeEmpty();
});

test("someone who unsubscribed is told the same as anyone, and stays unsubscribed", async ({
  page,
  request,
}, testInfo) => {
  const email = addressFor(testInfo, "unsubscribed");
  await putStandInSubscriber(request, email, { status: "unsubscribed", groups: [] });
  await page.goto("/blog");

  const box = signupBox(page);
  await box.getByLabel("Email address").fill(email);
  await box.getByRole("button", { name: "Subscribe" }).click();

  await expect(box.getByRole("status")).toHaveText(SIGNUP_MESSAGES.done);
  expect(await standInSubscriber(request, email)).toEqual({
    status: "unsubscribed",
    groups: [],
    confirmationEmails: 0,
  });
});

test("the box says when MailerLite can't take the signup, and keeps the address", async ({
  page,
  request,
}, testInfo) => {
  const email = addressFor(testInfo, "failing");
  await failStandInOnce(request, email, 500);
  await page.goto("/blog");

  const box = signupBox(page);
  await box.getByLabel("Email address").fill(email);
  await box.getByRole("button", { name: "Subscribe" }).click();

  await expect(box.getByRole("alert")).toHaveText(SIGNUP_MESSAGES.unavailable);
  await expect(box.getByLabel("Email address")).toHaveValue(email);
  await expect(box.getByLabel("Email address")).not.toHaveAttribute("aria-invalid");
  expect(await standInSubscriber(request, email)).toBeNull();
});
