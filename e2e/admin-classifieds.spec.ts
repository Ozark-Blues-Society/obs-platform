import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { MAILPIT_URL } from "./support/mailpit";
import { FIXTURE_PASSWORD, accessToken, supabaseHeaders } from "./support/member-files";
import { SUPABASE_URL } from "./support/supabase-auth";

// The classifieds moderation queue (backlog A-3, K-2) against the local Supabase stack and Mailpit,
// with the synthetic fixture members (scripts/fixtures/members.mts). Each test sends listings of its
// own as an active member, through Supabase's API, and decides only on those: the fixture listings
// stay as the seed made them. Emails go to Mailpit (playwright.config.ts), never to real people.
const POSTER = "marcus.lane@example.com"; // Band, active
const MODERATOR = "dale.ramsey@example.com";
const QUEUE = "/admin/classifieds";

// A 1x1 PNG.
const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** A suffix of this test's own, so tests running at the same time never touch each other's. */
const runOf = (testInfo: TestInfo) => `(${testInfo.project.name}, ${testInfo.testId.slice(-8)})`;

type Listing = { id: string; title: string; photo_path: string | null };

/** Sends a listing as the poster, through Supabase's API, optionally with a photo uploaded first. */
async function postListing(
  request: APIRequestContext,
  title: string,
  {
    photo = false,
    body = "Hand-wired, 15 W.\nLocal pickup only.",
  }: { photo?: boolean; body?: string } = {},
): Promise<Listing> {
  const token = await accessToken(request, POSTER);
  let photoPath: string | null = null;
  if (photo) {
    const posterId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
    photoPath = `${posterId}/${randomUUID()}.png`;
    const upload = await request.post(
      `${SUPABASE_URL}/storage/v1/object/listing-photos/${photoPath}`,
      { headers: { ...supabaseHeaders(token), "content-type": "image/png" }, data: PHOTO },
    );
    expect(upload.ok(), `uploading the photo: ${await upload.text()}`).toBe(true);
  }
  const response = await request.post(`${SUPABASE_URL}/rest/v1/listings`, {
    headers: { ...supabaseHeaders(token), prefer: "return=representation" },
    data: {
      category: "gear",
      title,
      body,
      price: 650,
      contact_pref: "email",
      photo_path: photoPath,
    },
  });
  expect(response.status(), `sending ${title}: ${await response.text()}`).toBe(201);
  const [listing] = (await response.json()) as Listing[];
  return listing;
}

/** The listing as `token`'s member (or a visitor, without one) can read it, or undefined. */
async function readListing(request: APIRequestContext, id: string, token?: string) {
  const response = await request.get(`${SUPABASE_URL}/rest/v1/listings`, {
    headers: supabaseHeaders(token),
    params: { select: "status,reject_reason,title,photo_path", id: `eq.${id}` },
  });
  expect(response.ok()).toBe(true);
  const [listing] = (await response.json()) as {
    status: string;
    reject_reason: string | null;
    title: string;
    photo_path: string | null;
  }[];
  return listing;
}

/** Waits for the email with `subject` sent to the poster whose text has `text`; returns its text. */
async function emailToPoster(request: APIRequestContext, subject: string, text: string) {
  let found = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${POSTER}" subject:"${subject}"`, limit: 50 },
        });
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        for (const { ID } of messages) {
          const message = await request.get(`${MAILPIT_URL}/api/v1/message/${ID}`);
          const { Text } = (await message.json()) as { Text: string };
          if (Text.includes(text)) found = Text;
        }
        return found;
      },
      { message: `an email "${subject}" about ${text}`, timeout: 15_000 },
    )
    .not.toBe("");
  return found;
}

async function signIn(page: Page, email: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(QUEUE)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${QUEUE}$`));
}

/** The queue's card for the listing titled `title`. */
const cardOf = (page: Page, title: string) =>
  page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title }) });

test("a visitor is sent to sign in first", async ({ page }) => {
  await page.goto(QUEUE);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fclassifieds$/);
});

test("a member who doesn't moderate can't open the queue", async ({ page }) => {
  await signIn(page, POSTER);
  const main = page.getByRole("main");
  await expect(main).toContainText(
    "Only moderators and administrators can review classified listings.",
  );
  await expect(main.getByRole("heading", { name: /Waiting for review/ })).toHaveCount(0);
});

test.describe("a moderator", () => {
  // Delete this test's listings and photos, as the poster, whatever happened to them.
  test.afterEach(async ({ request }, testInfo) => {
    const token = await accessToken(request, POSTER);
    const rows = await request.get(`${SUPABASE_URL}/rest/v1/listings`, {
      headers: supabaseHeaders(token),
      params: { select: "id,photo_path", title: `like.*${runOf(testInfo)}` },
    });
    for (const row of (await rows.json()) as Listing[]) {
      await request.delete(`${SUPABASE_URL}/rest/v1/listings`, {
        headers: supabaseHeaders(token),
        params: { id: `eq.${row.id}` },
      });
      if (row.photo_path) {
        await request.delete(`${SUPABASE_URL}/storage/v1/object/listing-photos`, {
          headers: supabaseHeaders(token),
          data: { prefixes: [row.photo_path] },
        });
      }
    }
  });

  test("approves a listing: it goes live with its photo, and the poster gets an email", async ({
    page,
    request,
  }, testInfo) => {
    const amp = await postListing(request, `E2E amp ${runOf(testInfo)}`, { photo: true });
    const later = await postListing(request, `E2E later amp ${runOf(testInfo)}`);
    await signIn(page, MODERATOR);

    // Oldest first: the first listing sent comes before the later one.
    await expect(cardOf(page, later.title)).toBeVisible();
    const titles = await page
      .getByRole("main")
      .getByRole("heading", { level: 3 })
      .allTextContents();
    const position = (title: string) => titles.findIndex((text) => text.startsWith(title));
    expect(position(amp.title)).toBeGreaterThanOrEqual(0);
    expect(position(amp.title)).toBeLessThan(position(later.title));

    const card = cardOf(page, amp.title);
    await expect(card).toContainText("Hand-wired, 15 W.");
    await expect(card).toContainText("$650");
    await expect(card).toContainText("by Marcus L.");
    const photo = card.getByRole("img", { name: `The photo sent with “${amp.title}”` });
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1);

    await card.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByRole("main").getByRole("status")).toContainText(
      `“${amp.title}” is approved and on the classifieds until`,
    );
    await expect(page.getByRole("main").getByRole("status")).toContainText("We emailed the poster");
    await expect(cardOf(page, amp.title)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Waiting for review/ })).toBeFocused();

    const email = await emailToPoster(request, "Your classified listing is live", amp.title);
    expect(email).toContain("Our moderator approved your listing");

    // Live for everyone now, visitors included, with the photo the moderator saw.
    expect((await readListing(request, amp.id))?.status).toBe("live");
    const sign = await request.post(
      `${SUPABASE_URL}/storage/v1/object/sign/listing-photos/${amp.photo_path}`,
      { headers: supabaseHeaders(), data: { expiresIn: 60 } },
    );
    expect(sign.ok()).toBe(true);
    // The later listing still waits.
    await expect(cardOf(page, later.title)).toBeVisible();
  });

  test("rejects a listing with a reason, which the poster gets by email", async ({
    page,
    request,
  }, testInfo) => {
    const listing = await postListing(request, `E2E rejected amp ${runOf(testInfo)}`);
    await signIn(page, MODERATOR);
    const card = cardOf(page, listing.title);

    await card.getByRole("button", { name: "Reject" }).click();
    const reason = card.getByRole("textbox", { name: "Reason for the poster" });
    await expect(reason).toBeFocused();
    await card.getByRole("button", { name: "Reject and email the poster" }).click();
    await expect(reason).toBeFocused();
    await expect(reason).toHaveAccessibleDescription(/Write the reason for the poster\.$/);

    const why = `Amps go in Gear with a photo. Please send it again with one. ${runOf(testInfo)}`;
    await reason.fill(why);
    await card.getByRole("button", { name: "Reject and email the poster" }).click();

    await expect(page.getByRole("main").getByRole("status")).toContainText(
      `“${listing.title}” is rejected. We emailed the poster your reason.`,
    );
    await expect(cardOf(page, listing.title)).toHaveCount(0);

    const email = await emailToPoster(request, "Your classified listing wasn't approved", why);
    expect(email).toContain(listing.title);

    const posterToken = await accessToken(request, POSTER);
    expect(await readListing(request, listing.id, posterToken)).toMatchObject({
      status: "rejected",
      reject_reason: why,
    });
    expect(await readListing(request, listing.id)).toBeUndefined();
  });

  test("wraps a long link in a listing, so the queue still fits the screen", async ({
    page,
    request,
  }, testInfo) => {
    // Links are one long word each: in the title, wider than the card on a phone, and a shared
    // album's in the details, wider than the card on a phone and on a desktop.
    const titleLink = `example.org/amp/${"a1b2c3d4".repeat(6)}`;
    const link = `https://photos.example.org/share/${"a1b2c3d4".repeat(14)}`;
    const listing = await postListing(request, `E2E ${titleLink} ${runOf(testInfo)}`, {
      body: `Photos: ${link}`,
    });
    await signIn(page, MODERATOR);
    await expect(cardOf(page, listing.title)).toContainText(link);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "how far the page is wider than the window, in pixels").toBe(0);
  });

  test("doesn't approve a change the poster made while the moderator was looking", async ({
    page,
    request,
  }, testInfo) => {
    const listing = await postListing(request, `E2E changing amp ${runOf(testInfo)}`);
    await signIn(page, MODERATOR);
    await expect(cardOf(page, listing.title)).toBeVisible();

    // The poster changes the listing after the queue showed it.
    const changed = `E2E changed amp ${runOf(testInfo)}`;
    const posterToken = await accessToken(request, POSTER);
    const edit = await request.patch(`${SUPABASE_URL}/rest/v1/listings`, {
      headers: supabaseHeaders(posterToken),
      params: { id: `eq.${listing.id}` },
      data: { title: changed },
    });
    expect(edit.ok(), await edit.text()).toBe(true);

    await cardOf(page, listing.title).getByRole("button", { name: "Approve" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      `The poster changed “${changed}” while you were looking at it, so nothing was decided.`,
    );
    // The queue now shows the new version, still waiting.
    await expect(cardOf(page, changed)).toBeVisible();
    expect((await readListing(request, listing.id, posterToken))?.status).toBe("pending");

    await cardOf(page, changed).getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      `“${changed}” is approved`,
    );
    expect((await readListing(request, listing.id))?.title).toBe(changed);
  });

  test("says so when the poster deleted the listing first, and keeps focus in the queue", async ({
    page,
    request,
  }, testInfo) => {
    const listing = await postListing(request, `E2E deleted amp ${runOf(testInfo)}`);
    await signIn(page, MODERATOR);
    const approve = cardOf(page, listing.title).getByRole("button", { name: "Approve" });
    await expect(approve).toBeVisible();

    // The poster deletes the listing after the queue showed it.
    const posterToken = await accessToken(request, POSTER);
    await request.delete(`${SUPABASE_URL}/rest/v1/listings`, {
      headers: supabaseHeaders(posterToken),
      params: { id: `eq.${listing.id}` },
    });
    expect(await readListing(request, listing.id, posterToken)).toBeUndefined();

    await approve.click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "That listing was deleted by its poster, so there's nothing to decide.",
    );
    // The refreshed queue drops the card, and the button that had focus with it: focus goes to the
    // list's heading, not to the page.
    await expect(cardOf(page, listing.title)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Waiting for review/ })).toBeFocused();
  });
});
