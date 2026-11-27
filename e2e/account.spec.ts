import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { BENEFITS, MEMBER_PERK_CODE, SPONSOR_PERK_CODE } from "./fixtures/sanity-site-settings.mts";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// My Account (backlog M-8), against the local Supabase stack and the e2e stand-in for Sanity, whose
// Site settings hold a perk code for every level and one for Sponsor members
// (e2e/fixtures/sanity-site-settings.mts).
//
// Each test makes the member it needs, with that membership, and deletes them afterwards. The
// seeded fixture members' dates drift as a local stack ages, and other tests sign them in. The
// addresses carry the browser project's name, so the desktop and phone runs never share a member.

const ADDRESS_PREFIX = "my-account.";
const PASSWORD = "my-account-e2e-only";
const DAY = 24 * 60 * 60 * 1000;

type Membership = {
  level: "individual" | "band" | "business" | "sponsor";
  /** Days from now until expires_at: negative once it has lapsed. */
  expiresInDays: number;
  autoRenew: boolean;
};

type TestMember = { id: string; email: string; expiresAt: string; joinedAt: string };

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes the members whose address starts with `prefix`, with their profiles. */
async function deleteMembers(admin: SupabaseClient, prefix: string) {
  const { data, error } = await admin.from("profiles").select("id").like("email", `${prefix}%`);
  expect(error).toBeNull();
  for (const { id } of data ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    expect(deleteError).toBeNull();
  }
}

/**
 * Runs `body` with a new member who has this membership, as the payment webhook (M-5) will record it, and
 * deletes them afterwards, with any an earlier run of the same test left behind.
 */
async function withMember(
  testInfo: TestInfo,
  name: string,
  membership: Membership,
  body: (member: TestMember) => Promise<void>,
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
    const id = data.user!.id;
    const expiresAt = new Date(Date.now() + membership.expiresInDays * DAY).toISOString();
    const joinedAt = new Date(Date.parse(expiresAt) - 3 * 365 * DAY).toISOString();
    // The sign-up trigger has made the profile.
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        level: membership.level,
        expires_at: expiresAt,
        auto_renew: membership.autoRenew,
        joined_at: joinedAt,
        phone: "(479) 555-0177",
      })
      .eq("id", id);
    expect(updateError).toBeNull();
    await body({ id, email, expiresAt, joinedAt });
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
  await expect(page.getByRole("heading", { level: 1, name: "My Account" })).toBeVisible();
}

/** "March 14, 2027": the day a timestamp falls on in the Society's time zone. */
const longDate = (timestamp: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/Chicago" }).format(
    new Date(timestamp),
  );
const year = (timestamp: string) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "America/Chicago" }).format(
    new Date(timestamp),
  );

/** Each term in a card's definition list with its definition, as the page reads them. */
async function facts(card: Locator): Promise<[string, string][]> {
  await expect(card).toBeVisible();
  return card.evaluate((element) =>
    [...element.querySelectorAll("dt")].map((term): [string, string] => [
      term.textContent ?? "",
      term.nextElementSibling?.textContent ?? "",
    ]),
  );
}

const benefitsOf = (level: Membership["level"]) =>
  BENEFITS.filter((benefit) => benefit.levels.includes(level)).map((benefit) => benefit.text);

/**
 * Everything the server sends for a page: its HTML, and the RSC payload a client-side navigation
 * fetches. `request` carries the cookies of whoever is asking.
 */
async function everythingSent(request: APIRequestContext, path: string): Promise<string> {
  const html = await request.get(path);
  const rsc = await request.get(path, { headers: { RSC: "1" } });
  expect(html.status()).toBe(200);
  expect(rsc.status()).toBe(200);
  return `${await html.text()}\n${await rsc.text()}`;
}

async function expectNoSidewaysScrolling(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
}

test("an active Sponsor member sees their membership and both perk codes", async ({
  page,
}, testInfo) => {
  const membership = { level: "sponsor", expiresInDays: 200, autoRenew: false } as const;
  await withMember(testInfo, "sponsor", membership, async (member) => {
    await signIn(page, member.email);

    const card = page.getByRole("region", { name: "Sponsor member" });
    expect(await facts(card)).toEqual([
      ["Level", "Sponsor"],
      ["Status", "Active"],
      ["Renewal date", longDate(member.expiresAt)],
      ["Auto-renew", "Off"],
      ["Member since", year(member.joinedAt)],
    ]);
    await expect(card.getByRole("link")).toHaveCount(0);

    const perks = page.getByRole("region", { name: "Member perks" });
    expect(await facts(perks)).toEqual([
      ["Member discount code", MEMBER_PERK_CODE],
      ["Sponsor discount code", SPONSOR_PERK_CODE],
    ]);
    await expect(perks.getByRole("listitem")).toHaveText(benefitsOf("sponsor"));
    await expectNoSidewaysScrolling(page);
  });
});

test("an Individual member on auto-renew gets the member code but never the Sponsor code", async ({
  page,
}, testInfo) => {
  // Within 30 days of the renewal date, but it renews by itself: nothing for the member to do.
  const membership = { level: "individual", expiresInDays: 12, autoRenew: true } as const;
  await withMember(testInfo, "auto-renew", membership, async (member) => {
    await signIn(page, member.email);

    const card = page.getByRole("region", { name: "Individual member" });
    expect(await facts(card)).toEqual([
      ["Level", "Individual"],
      ["Status", "Active"],
      ["Renewal date", longDate(member.expiresAt)],
      ["Auto-renew", "On"],
      ["Member since", year(member.joinedAt)],
    ]);
    await expect(card.getByRole("link")).toHaveCount(0);

    const perks = page.getByRole("region", { name: "Member perks" });
    expect(await facts(perks)).toEqual([["Member discount code", MEMBER_PERK_CODE]]);
    await expect(perks.getByRole("listitem")).toHaveText(benefitsOf("individual"));
    const sent = await everythingSent(page.request, "/account");
    expect(sent).toContain(MEMBER_PERK_CODE);
    expect(sent).not.toContain(SPONSOR_PERK_CODE);
  });
});

test("a member whose membership ends soon is asked to renew", async ({ page }, testInfo) => {
  const membership = { level: "band", expiresInDays: 12, autoRenew: false } as const;
  await withMember(testInfo, "ends-soon", membership, async (member) => {
    await signIn(page, member.email);

    const card = page.getByRole("region", { name: "Band member" });
    expect(await facts(card)).toContainEqual(["Status", "Expiring soon"]);
    await expect(card).toContainText(
      `Renew by ${longDate(member.expiresAt)} to keep your member perks.`,
    );
    await expect(card.getByRole("link", { name: "Renew now" })).toHaveAttribute("href", "/join");
  });
});

test("a lapsed member sees when it ended and how to renew, and gets no perk codes", async ({
  page,
}, testInfo) => {
  const membership = { level: "sponsor", expiresInDays: -20, autoRenew: true } as const;
  await withMember(testInfo, "lapsed", membership, async (member) => {
    await signIn(page, member.email);

    const card = page.getByRole("region", { name: "Your membership has ended" });
    expect(await facts(card)).toEqual([
      ["Level", "Sponsor"],
      ["Status", "Ended"],
      ["Ended on", longDate(member.expiresAt)],
    ]);
    await expect(card.getByRole("link", { name: "Renew your membership" })).toHaveAttribute(
      "href",
      "/join",
    );
    await expect(page.getByRole("region", { name: "Member perks" })).toContainText(
      "Your perk codes and member benefits come back when you renew.",
    );

    const sent = await everythingSent(page.request, "/account");
    expect(sent).toContain("Your membership has ended");
    expect(sent).not.toContain(MEMBER_PERK_CODE);
    expect(sent).not.toContain(SPONSOR_PERK_CODE);
    await expectNoSidewaysScrolling(page);
  });
});

test("no page sends a perk code to a visitor", async ({ request }) => {
  // Every page loads Site settings for its footer (sanity/site-chrome.ts), without the codes.
  for (const path of ["/", "/sign-in"]) {
    const sent = await everythingSent(request, path);
    expect(sent, path).not.toContain(MEMBER_PERK_CODE);
    expect(sent, path).not.toContain(SPONSOR_PERK_CODE);
  }
});

test("a member changes their name and phone, but nothing else", async ({ page }, testInfo) => {
  const membership = { level: "individual", expiresInDays: 100, autoRenew: false } as const;
  await withMember(testInfo, "details", membership, async (member) => {
    await signIn(page, member.email);
    const details = page.getByRole("region", { name: "Your details" });
    const firstName = details.getByLabel("First name");
    const lastName = details.getByLabel("Last name (optional)");
    const phone = details.getByLabel("Phone (optional)");
    const save = details.getByRole("button", { name: "Save details" });
    await expect(firstName).toHaveValue("Sam");
    await expect(lastName).toHaveValue("Rivers");
    await expect(phone).toHaveValue("(479) 555-0177");

    // Each problem is announced and tied to the field it's about, and what was typed stays.
    await firstName.fill("");
    await save.click();
    await expect(details.getByRole("alert")).toHaveText("Enter your first name.");
    await expect(firstName).toHaveAttribute("aria-invalid", "true");
    await firstName.fill("Samantha");
    await phone.fill("call me");
    await save.click();
    await expect(details.getByRole("alert")).toHaveText(
      "Enter a phone number with its area code, such as (479) 555-0123, or leave it blank.",
    );
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(firstName).toHaveValue("Samantha");

    await lastName.fill("  Rivers-Hale ");
    await phone.fill("479-555-0188");
    await save.click();
    await expect(details.getByRole("status")).toHaveText("Your details are saved.");
    await expect(lastName).toHaveValue("Rivers-Hale");

    await page.reload();
    await expect(firstName).toHaveValue("Samantha");
    await expect(lastName).toHaveValue("Rivers-Hale");
    await expect(phone).toHaveValue("479-555-0188");

    const { data, error } = await adminClient()
      .from("profiles")
      .select("first_name, last_name, phone, level, expires_at")
      .eq("id", member.id)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      first_name: "Samantha",
      last_name: "Rivers-Hale",
      phone: "479-555-0188",
      level: "individual",
    });
    expect(Date.parse(data!.expires_at)).toBe(Date.parse(member.expiresAt));
  });
});
