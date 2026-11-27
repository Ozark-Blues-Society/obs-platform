import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { MAILPIT_URL, clearInbox, emailsTo } from "./support/mailpit";
import { secretKey, SUPABASE_URL } from "./support/supabase-auth";

// The public classifieds (backlog K-3) against the local Supabase stack and Mailpit: the live
// listings by category, a listing's page, and writing to its poster, whose address stays private.
// Viewing is public; posting needs an active membership (board-decisions §7).
//
// The list's checks use the seeded fixture listings (scripts/fixtures/listings.mts). Every other
// test makes the members and the live listing it needs, and deletes them afterwards (with their
// listings and messages). The addresses carry the browser project's name, so the desktop and phone
// runs never share a member.

const ADDRESS_PREFIX = "classifieds.";
const PASSWORD = "classifieds-e2e-only";
const POSTER_PHONE = "(479) 555-0142";

type TestMember = { id: string; email: string };
type TestListing = { id: string; title: string; path: string };

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Deletes the members whose address starts with `prefix`, with their listings and messages. */
async function deleteMembers(admin: SupabaseClient, prefix: string) {
  const { data, error } = await admin.from("profiles").select("id").like("email", `${prefix}%`);
  expect(error).toBeNull();
  for (const { id } of data ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    expect(deleteError).toBeNull();
  }
}

/** A new member with a year of Band membership, the phone number above and these names. */
async function addMember(
  admin: SupabaseClient,
  prefix: string,
  name: { first_name: string; last_name: string },
): Promise<TestMember> {
  const email = `${prefix}${randomBytes(4).toString("hex")}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: name,
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  // The sign-up trigger has made the profile.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      level: "band",
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      phone: POSTER_PHONE,
    })
    .eq("id", id);
  expect(updateError).toBeNull();
  return { id, email };
}

/** A live listing by `poster`: submitted, then approved, as a moderator would. */
async function addLiveListing(
  admin: SupabaseClient,
  poster: TestMember,
  listing: {
    category: string;
    title: string;
    body: string;
    price?: number;
    contact_pref?: "email" | "phone";
  },
): Promise<TestListing> {
  const { data, error } = await admin
    .from("listings")
    .insert({ profile_id: poster.id, contact_pref: "email", ...listing })
    .select("id")
    .single();
  expect(error).toBeNull();
  const id = (data as { id: string }).id;
  const { error: approveError } = await admin
    .from("listings")
    .update({ status: "live" })
    .eq("id", id);
  expect(approveError).toBeNull();
  return { id, title: listing.title, path: `/classifieds/${id}` };
}

/**
 * Runs `body` with a poster (Lou Tate) and a sender (Jo Ames), both active members, and deletes
 * them afterwards, with any an earlier run of the same test left behind.
 */
async function withMembers(
  testInfo: TestInfo,
  name: string,
  body: (members: {
    admin: SupabaseClient;
    poster: TestMember;
    sender: TestMember;
  }) => Promise<void>,
) {
  const admin = adminClient();
  const prefix = `${ADDRESS_PREFIX}${testInfo.project.name}.${name}.`;
  await deleteMembers(admin, prefix);
  try {
    const poster = await addMember(admin, `${prefix}poster.`, {
      first_name: "Lou",
      last_name: "Tate",
    });
    const sender = await addMember(admin, `${prefix}sender.`, {
      first_name: "Jo",
      last_name: "Ames",
    });
    await body({ admin, poster, sender });
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
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

/** Everything the server sends for a page: its HTML, and the RSC payload a navigation fetches. */
async function everythingSent(request: APIRequestContext, path: string): Promise<string> {
  const html = await request.get(path);
  const rsc = await request.get(path, { headers: { RSC: "1" } });
  expect(html.status()).toBe(200);
  expect(rsc.status()).toBe(200);
  return `${await html.text()}\n${await rsc.text()}`;
}

/** The page fits the screen: nothing makes it scroll sideways (the phone project is 390px). */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "pixels the page is wider than the screen").toBeLessThanOrEqual(0);
}

const cardTitles = (page: Page) =>
  page.getByRole("main").getByRole("article").getByRole("heading", { level: 2 });

test("visitors see the live listings by category, and nothing pending, rejected or expired", async ({
  page,
}) => {
  await page.goto("/classifieds");
  await expect(page.getByRole("heading", { level: 1, name: "Musician Classifieds" })).toBeVisible();
  await expect(cardTitles(page).filter({ hasText: "Bass player needed" })).toHaveText(
    "Bass player needed for a Chicago-style blues band",
  );
  await expect(
    page.getByRole("link", { name: "Contact Dale R. about “Bass player needed" }),
  ).toBeVisible();
  // Waiting for a moderator, rejected, and past its 60 days.
  for (const hidden of ["Harmonica set", "CHEAP SUNGLASSES", "Vintage Silvertone"]) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }

  const categories = page.getByRole("navigation", { name: "Classifieds categories" });
  await expect(categories.getByRole("link", { name: "All" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await categories.getByRole("link", { name: "Gear" }).click();
  await expect(page).toHaveURL(/\/classifieds\?category=gear$/);
  await expect(categories.getByRole("link", { name: "Gear" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("main").getByRole("status")).toHaveText(/^\d+ Gear listings?\.$/);
  await expect(cardTitles(page).filter({ hasText: "Tweed-style" })).toHaveText(
    "Tweed-style 1x12 tube amp, 15 W — $650",
  );
  await expect(page.getByText("Bass player needed")).toHaveCount(0);
  await expect(page).toHaveTitle("Gear · Classifieds · Ozark Blues Society");
});

test("a visitor's Post a listing asks them to sign in or join", async ({ page }) => {
  await page.goto("/classifieds");
  const post = page.getByRole("link", { name: "Post a listing" });
  await post.click();
  const dialog = page.getByRole("dialog", { name: "Posting is a member benefit" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in?next=%2Faccount%2Flistings%2Fnew",
  );
  await expect(dialog.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(post).toBeFocused();
});

test("an address with no live listing is a page not found", async ({ page, request }) => {
  // A fixture listing waiting for a moderator, then something that isn't a listing's id at all.
  for (const path of ["/classifieds/00000000-0000-4000-8200-000000000004", "/classifieds/amp"]) {
    await page.goto(path);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    expect(await (await request.get(path)).text()).toContain(
      '<meta name="robots" content="noindex"/>',
    );
  }
});

test.describe("a listing's page", () => {
  test("shows the listing, and a visitor signs in to contact the poster", async ({
    page,
    request,
  }, testInfo) => {
    await withMembers(testInfo, "visitor", async ({ admin, poster }) => {
      const listing = await addLiveListing(admin, poster, {
        category: "gear",
        title: "E2E chromatic harmonica",
        body: "Seven keys.\nLightly used.",
        price: 120,
      });
      await page.goto(listing.path);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(listing.title);
      await expect(main).toContainText("$120");
      await expect(main).toContainText("Posted by Lou T. on");
      await expect(page).toHaveTitle(`${listing.title} · Classifieds · Ozark Blues Society`);

      const contact = main.getByRole("region", { name: "Contact the poster" });
      await expect(contact.getByRole("link", { name: "Sign in to contact" })).toHaveAttribute(
        "href",
        `/sign-in?next=${encodeURIComponent(listing.path)}`,
      );
      await expect(contact.getByRole("textbox")).toHaveCount(0);

      const sent = await everythingSent(request, listing.path);
      expect(sent).toContain(listing.title);
      expect(sent).not.toContain(poster.email);
      expect(sent).not.toContain(POSTER_PHONE);
    });
  });

  test("a member writes to the poster, who gets it by email and replies to the member", async ({
    page,
  }, testInfo) => {
    await withMembers(testInfo, "message", async ({ admin, poster, sender }) => {
      const listing = await addLiveListing(admin, poster, {
        category: "musicians_wanted",
        title: "E2E bass player wanted",
        body: "Gigging twice a month.",
      });
      await clearInbox(page.request, poster.email);
      // The Server Function's answers, which mustn't hold the poster's address.
      const answers: Promise<string>[] = [];
      page.on("response", (response) => {
        const { pathname } = new URL(response.url());
        if (response.request().method() === "POST" && pathname === listing.path) {
          answers.push(response.text());
        }
      });

      await signIn(page, sender.email, listing.path);
      const contact = page.getByRole("region", { name: "Contact the poster" });
      const message = contact.getByRole("textbox", { name: "Your message to Lou T." });
      await expect(message).toHaveAccessibleDescription(
        `We'll email it to them with your name and your email address, ${sender.email}, so they can reply to you. Their address stays private.`,
      );

      await contact.getByRole("button", { name: "Send message" }).click();
      await expect(message).toHaveAccessibleDescription(/Write your message\.$/);

      const words = `Still looking? I play upright and electric. (${randomBytes(3).toString("hex")})`;
      await message.fill(`${words}\nCall me after six.`);
      await contact.getByRole("button", { name: "Send message" }).click();
      await expect(contact.getByRole("status")).toHaveText(
        `Message sent. Lou T. will see your email address, ${sender.email}, and can reply to you there.`,
      );
      await expect(message).toHaveValue("");

      await expect
        .poll(async () => (await emailsTo(page.request, poster.email)).length, {
          message: `the message to ${poster.email}`,
          timeout: 15_000,
        })
        .toBe(1);
      const [summary] = await emailsTo(page.request, poster.email);
      expect(summary.Subject).toBe(`A message about your listing “${listing.title}”`);
      const email = (await (
        await page.request.get(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
      ).json()) as {
        From: { Name: string };
        ReplyTo: { Address: string }[];
        Text: string;
      };
      expect(email.From.Name).toBe("Ozark Blues Society");
      expect(email.ReplyTo.map((each) => each.Address)).toEqual([sender.email]);
      expect(email.Text).toContain(words);
      expect(email.Text).toContain("Call me after six.");
      expect(email.Text).toContain(`Jo Ames at ${sender.email}`);

      expect(answers).toHaveLength(2);
      expect((await Promise.all(answers)).join("\n")).not.toContain(poster.email);
      // Nor does the page, as the signed-in member gets it.
      expect(await everythingSent(page.request, listing.path)).not.toContain(poster.email);
    });
  });

  test("a poster who asked for calls shows members the number, and visitors nothing", async ({
    page,
    request,
  }, testInfo) => {
    await withMembers(testInfo, "phone", async ({ admin, poster, sender }) => {
      const listing = await addLiveListing(admin, poster, {
        category: "street_team",
        title: "E2E poster crew",
        body: "Two weekends before the show.",
        contact_pref: "phone",
      });
      expect(await everythingSent(request, listing.path)).not.toContain(POSTER_PHONE);

      await signIn(page, sender.email, listing.path);
      const contact = page.getByRole("region", { name: "Contact the poster" });
      await expect(contact).toContainText("Lou T. asked to be contacted by phone:");
      await expect(contact.getByRole("link", { name: POSTER_PHONE })).toHaveAttribute(
        "href",
        "tel:4795550142",
      );
      await expect(contact.getByRole("textbox")).toHaveCount(0);
    });
  });

  test("the poster sees their own listing without a form", async ({ page }, testInfo) => {
    await withMembers(testInfo, "own", async ({ admin, poster }) => {
      const listing = await addLiveListing(admin, poster, {
        category: "merch",
        title: "E2E band T-shirts",
        body: "All sizes.",
      });
      await signIn(page, poster.email, listing.path);
      const contact = page.getByRole("region", { name: "Contact the poster" });
      await expect(contact).toContainText("This is your listing.");
      await expect(contact.getByRole("textbox")).toHaveCount(0);
    });
  });

  test("long words and links wrap instead of widening the page", async ({ page }, testInfo) => {
    await withMembers(testInfo, "wrap", async ({ admin, poster }) => {
      // A share link from a marketplace: about 150 characters with no space to break at.
      const link = `https://www.example.com/marketplace/item/${"8".repeat(40)}?ref=share&tracking=${"a1b2c3d4".repeat(6)}`;
      const listing = await addLiveListing(admin, poster, {
        category: "member_connect",
        title: `E2E ${link.slice(0, 90)}`,
        body: `Details at ${link}`,
      });
      await page.goto("/classifieds?category=member-connect");
      await expect(cardTitles(page).filter({ hasText: "E2E https" })).toBeVisible();
      await expectNoSidewaysScroll(page);
      await page.goto(listing.path);
      await expect(page.getByRole("main")).toContainText(link);
      await expectNoSidewaysScroll(page);
    });
  });
});
