import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { supabaseHeaders } from "./support/member-files";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// My listings (backlog K-4) and its summary on My Account, against the local Supabase stack.
//
// Each test makes the member it needs, with listings in every status, and deletes them afterwards
// (their listings go with them). The addresses carry the browser project's name, so the desktop
// and phone runs never share a member. Dates are relative to now: the page and the database work
// from the real clock.

const ADDRESS_PREFIX = "my-listings.";
const PASSWORD = "my-listings-e2e-only";
const DAY = 24 * 60 * 60 * 1000;

type Seed = {
  key: string;
  title: string;
  status: "pending" | "live" | "rejected" | "expired";
  /** Days from now until expires_at: negative once it has passed. Null until approved. */
  expiresInDays: number | null;
  rejectReason?: string;
};

const LISTINGS: Seed[] = [
  { key: "soon", title: "Tweed amp, ends soon", status: "live", expiresInDays: 3 },
  { key: "later", title: "Bass player wanted", status: "live", expiresInDays: 40 },
  { key: "down", title: "Drum kit, came down", status: "expired", expiresInDays: -5 },
  { key: "waiting", title: "Harmonica set", status: "pending", expiresInDays: null },
  {
    key: "refused",
    title: "Cheap sunglasses",
    status: "rejected",
    expiresInDays: null,
    rejectReason: "Not about music.",
  },
];

type TestMember = { id: string; email: string; listingIds: Record<string, string> };

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes the members whose address starts with `prefix`, with their profiles and listings. */
async function deleteMembers(admin: SupabaseClient, prefix: string) {
  const { data, error } = await admin.from("profiles").select("id").like("email", `${prefix}%`);
  expect(error).toBeNull();
  for (const { id } of data ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    expect(deleteError).toBeNull();
  }
}

/**
 * Runs `body` with a new member whose membership ends in `membershipDays` days (negative: it has
 * ended), with the listings above, and deletes them afterwards, with any an earlier run of the same
 * test left behind.
 */
async function withMember(
  testInfo: TestInfo,
  name: string,
  membershipDays: number,
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
      user_metadata: { first_name: "Sam" },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    const { error: updateError } = await admin
      .from("profiles")
      .update({ level: "band", expires_at: new Date(Date.now() + membershipDays * DAY) })
      .eq("id", id);
    expect(updateError).toBeNull();

    // As K-1's form and K-2's moderators leave them; one posted a day before the next.
    const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
    const { data: rows, error: insertError } = await admin
      .from("listings")
      .insert(
        LISTINGS.map((seed, index) => ({
          profile_id: id,
          category: "gear",
          title: seed.title,
          body: "Details.",
          status: seed.status,
          reject_reason: seed.rejectReason ?? null,
          created_at: at(-70 + index),
          approved_at: seed.expiresInDays === null ? null : at(seed.expiresInDays - 60),
          expires_at: seed.expiresInDays === null ? null : at(seed.expiresInDays),
        })),
      )
      .select("id, title");
    expect(insertError).toBeNull();
    const listingIds = Object.fromEntries(
      LISTINGS.map((seed) => [seed.key, rows!.find((row) => row.title === seed.title)!.id]),
    );
    await body({ id, email, listingIds });
  } finally {
    await deleteMembers(admin, prefix);
  }
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL((url) => url.pathname + url.search === next);
}

/** The card of the listing with this title. */
const card = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });

/** "Jan 26, 2027": a date as the page writes it, in the Society's time zone. */
const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(date);

async function expectNoSidewaysScrolling(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
}

test("a visitor is sent to sign in first, and comes back to the listing the email named", async ({
  page,
}) => {
  await page.goto("/account/listings?renew=00000000-0000-4000-8940-000000000001");
  await expect(page).toHaveURL(
    "/sign-in?next=%2Faccount%2Flistings%3Frenew%3D00000000-0000-4000-8940-000000000001",
  );
});

test("a member sees every listing and where it stands, and renews the ones due", async ({
  page,
  request,
}, testInfo) => {
  await withMember(testInfo, "renews", 200, async (member) => {
    await signIn(page, member.email, "/account/listings");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2 })).toHaveText("Your listings (5)");
    await expect(card(page, "Harmonica set")).toContainText("Awaiting review");
    await expect(card(page, "Cheap sunglasses")).toContainText(
      "The moderator's reason: Not about music.",
    );
    await expect(card(page, "Bass player wanted")).toContainText("You can renew it from");
    await expect(card(page, "Drum kit, came down")).toContainText("Expired");
    for (const title of ["Bass player wanted", "Harmonica set", "Cheap sunglasses"]) {
      await expect(card(page, title).getByRole("button", { name: "Renew" })).toHaveCount(0);
    }
    await expectNoSidewaysScrolling(page);

    // Renewing the live one that ends in 3 days: 60 days from now.
    const soon = card(page, "Tweed amp, ends soon");
    await soon.getByRole("button", { name: "Renew" }).click();
    const newEnd = shortDate(new Date(Date.now() + 60 * DAY));
    await expect(main.getByRole("status")).toHaveText(
      `“Tweed amp, ends soon” is renewed: it's on the classifieds until ${newEnd}.`,
    );
    await expect(main.getByRole("heading", { level: 2 })).toBeFocused();
    await expect(soon).toContainText(`On the classifieds until ${newEnd}.`);
    await expect(soon.getByRole("button", { name: "Renew" })).toHaveCount(0);

    // Renewing the one that came down puts it back up, for visitors too.
    const down = card(page, "Drum kit, came down");
    await down.getByRole("button", { name: "Renew" }).click();
    await expect(main.getByRole("status")).toContainText("“Drum kit, came down” is renewed");
    await expect(down).toContainText("Live");
    const visitor = await request.get(`${SUPABASE_URL}/rest/v1/listings`, {
      headers: supabaseHeaders(),
      params: { select: "title", id: `eq.${member.listingIds.down}` },
    });
    expect(await visitor.json()).toEqual([{ title: "Drum kit, came down" }]);
  });
});

test("a member removes a listing after confirming it", async ({ page }, testInfo) => {
  await withMember(testInfo, "removes", 200, async (member) => {
    await signIn(page, member.email, "/account/listings");
    const main = page.getByRole("main");
    const sunglasses = card(page, "Cheap sunglasses");

    await sunglasses.getByRole("button", { name: "Remove" }).click();
    await expect(sunglasses.getByRole("button", { name: "Remove the listing" })).toBeFocused();
    await sunglasses.getByRole("button", { name: "Keep it" }).click();
    await expect(sunglasses.getByRole("button", { name: "Remove" })).toBeFocused();

    await sunglasses.getByRole("button", { name: "Remove" }).click();
    await sunglasses.getByRole("button", { name: "Remove the listing" }).click();
    await expect(main.getByRole("status")).toHaveText(
      "“Cheap sunglasses” is removed. It's no longer on the classifieds.",
    );
    await expect(main.getByRole("heading", { level: 2 })).toHaveText("Your listings (4)");
    await expect(card(page, "Cheap sunglasses")).toHaveCount(0);

    const { data, error } = await adminClient()
      .from("listings")
      .select("id")
      .eq("id", member.listingIds.refused);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

test("the reminder's link opens My listings at that listing", async ({ page }, testInfo) => {
  await withMember(testInfo, "reminder", 200, async (member) => {
    await signIn(page, member.email, `/account/listings?renew=${member.listingIds.soon}`);
    const first = page.getByRole("main").getByRole("listitem").first();
    await expect(first.getByRole("heading", { level: 3 })).toHaveText("Tweed amp, ends soon");
    await expect(first).toContainText("Your reminder email was about this listing.");
    await expect(first.getByRole("button", { name: "Renew" })).toBeVisible();
  });
});

test("a member whose membership has ended sees their listings, and is asked to renew it first", async ({
  page,
}, testInfo) => {
  await withMember(testInfo, "lapsed", -2, async (member) => {
    await signIn(page, member.email, "/account/listings");
    const main = page.getByRole("main");
    await expect(main).toContainText(
      "Your membership has ended. Renew it, then you can renew your listings.",
    );
    await expect(main.getByRole("link", { name: "Renew your membership" })).toHaveAttribute(
      "href",
      "/join",
    );
    await expect(main.getByRole("heading", { level: 2 })).toHaveText("Your listings (5)");
    await expect(main.getByRole("button", { name: "Renew" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Post a listing" })).toHaveCount(0);
  });
});

test("My Account sums up the member's listings, with a link to My listings", async ({
  page,
}, testInfo) => {
  await withMember(testInfo, "account", 200, async (member) => {
    await signIn(page, member.email, "/account");
    const section = page.getByRole("region", { name: "My listings" });
    await expect(section.getByRole("listitem")).toHaveCount(5);
    await expect(section.getByRole("listitem").filter({ hasText: "Harmonica set" })).toContainText(
      "Awaiting review",
    );
    await expect(
      section.getByRole("listitem").filter({ hasText: "Tweed amp, ends soon" }),
    ).toContainText("Live, until");
    await section.getByRole("link", { name: "Renew or remove your listings" }).click();
    await expect(page).toHaveURL(/\/account\/listings$/);
    await expect(page.getByRole("heading", { level: 1, name: "My listings" })).toBeVisible();
    await expectNoSidewaysScrolling(page);
  });
});
