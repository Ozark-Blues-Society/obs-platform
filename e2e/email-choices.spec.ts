import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { EMAIL_CHOICES_MESSAGES } from "../lib/account/email-choices-state";
import { failStandInOnce, putStandInSubscriber, standInSubscriber } from "./support/mailerlite";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// The email switches on My Account (decision 0016), against the local Supabase stack and the
// MailerLite stand-in (e2e/support/mailerlite-stand-in.mts). MailerLite keeps the choices, so each
// test sets the member up in the stand-in and reads the result there.
//
// Each test makes the member it needs and deletes them afterwards. The addresses carry the browser
// project's name, so the desktop and phone (390px) runs never share a member.

const ADDRESS_PREFIX = "email-choices.";
const PASSWORD = "email-choices-e2e-only";
const YEAR = 365 * 24 * 60 * 60 * 1000;

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes the members whose address starts with `prefix`. */
async function deleteMembers(admin: SupabaseClient, prefix: string) {
  const { data, error } = await admin.from("profiles").select("id").like("email", `${prefix}%`);
  expect(error).toBeNull();
  for (const { id } of data ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    expect(deleteError).toBeNull();
  }
}

/** Runs `body` with a new Individual member, and deletes them afterwards. */
async function withMember(
  testInfo: TestInfo,
  name: string,
  body: (email: string) => Promise<void>,
) {
  const admin = adminClient();
  const prefix = `${ADDRESS_PREFIX}${testInfo.project.name}.${name}.`;
  await deleteMembers(admin, prefix);
  try {
    const email = `${prefix}${randomBytes(4).toString("hex")}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: "Sam", last_name: "Rivers" },
    });
    expect(error).toBeNull();
    const { error: updateError } = await admin
      .from("profiles")
      .update({ level: "individual", expires_at: new Date(Date.now() + YEAR).toISOString() })
      .eq("id", data.user!.id);
    expect(updateError).toBeNull();
    await body(email);
  } finally {
    await deleteMembers(admin, prefix);
  }
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=%2Faccount");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

const emailCard = (page: Page) =>
  page.getByRole("region", { name: "Newsletter and announcements" });
const newsletter = (page: Page) =>
  emailCard(page).getByRole("checkbox", { name: "Monthly newsletter" });
const events = (page: Page) =>
  emailCard(page).getByRole("checkbox", { name: "Event announcements" });

test("a member switches the newsletter off and event announcements on", async ({
  page,
  request,
}, testInfo) => {
  await withMember(testInfo, "switches", async (email) => {
    await putStandInSubscriber(request, email, {
      status: "active",
      groups: ["Newsletter", "Website: Active members"],
    });
    await signIn(page, email);

    const card = emailCard(page);
    await expect(newsletter(page)).toBeChecked();
    await expect(events(page)).not.toBeChecked();
    await expect(card).toContainText(EMAIL_CHOICES_MESSAGES.membershipEmails);
    await expect(card).not.toContainText(EMAIL_CHOICES_MESSAGES.paused);

    // From the keyboard: Space toggles a focused checkbox.
    await newsletter(page).focus();
    await page.keyboard.press("Space");
    await events(page).focus();
    await page.keyboard.press("Space");
    await card.getByRole("button", { name: "Save email choices" }).click();

    await expect(card.getByRole("status")).toHaveText(EMAIL_CHOICES_MESSAGES.saved);
    expect(await standInSubscriber(request, email)).toEqual({
      status: "active",
      groups: ["Event announcements", "Website: Active members"],
      confirmationEmails: 0,
    });
    // The page reads them from MailerLite again.
    await page.reload();
    await expect(newsletter(page)).not.toBeChecked();
    await expect(events(page)).toBeChecked();
  });
});

test("a member MailerLite doesn't have yet chooses both, and gets no confirmation email", async ({
  page,
  request,
}, testInfo) => {
  await withMember(testInfo, "new", async (email) => {
    await signIn(page, email);

    await expect(newsletter(page)).not.toBeChecked();
    await expect(events(page)).not.toBeChecked();
    await newsletter(page).check();
    await events(page).check();
    await emailCard(page).getByRole("button", { name: "Save email choices" }).click();

    await expect(emailCard(page).getByRole("status")).toHaveText(EMAIL_CHOICES_MESSAGES.saved);
    expect(await standInSubscriber(request, email)).toEqual({
      status: "active",
      groups: ["Event announcements", "Newsletter"],
      confirmationEmails: 0,
    });
  });
});

test("a member who unsubscribed sees why nothing reaches them, and comes back by choosing", async ({
  page,
  request,
}, testInfo) => {
  await withMember(testInfo, "unsubscribed", async (email) => {
    await putStandInSubscriber(request, email, {
      status: "unsubscribed",
      groups: ["Newsletter", "Event announcements"],
    });
    await signIn(page, email);

    const card = emailCard(page);
    await expect(card).toContainText(EMAIL_CHOICES_MESSAGES.paused);
    await expect(newsletter(page)).not.toBeChecked();
    await expect(events(page)).not.toBeChecked();
    await newsletter(page).check();
    await card.getByRole("button", { name: "Save email choices" }).click();

    await expect(card.getByRole("status")).toHaveText(EMAIL_CHOICES_MESSAGES.saved);
    await expect(card).not.toContainText(EMAIL_CHOICES_MESSAGES.paused);
    expect(await standInSubscriber(request, email)).toEqual({
      status: "active",
      groups: ["Newsletter"],
      confirmationEmails: 0,
    });
  });
});

test("My Account says when the email choices can't be shown, and the rest still works", async ({
  page,
  request,
}, testInfo) => {
  await withMember(testInfo, "unreachable", async (email) => {
    await putStandInSubscriber(request, email, { status: "active", groups: ["Newsletter"] });
    await failStandInOnce(request, email, 503);
    await signIn(page, email);

    await expect(emailCard(page).getByRole("alert")).toHaveText(EMAIL_CHOICES_MESSAGES.cantShow);
    await expect(emailCard(page).getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Your details" })).toBeVisible();
  });
});
