import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { FIXTURE_PASSWORD, accessToken, supabaseHeaders } from "./support/member-files";
import { SUPABASE_URL } from "./support/supabase-auth";

// Posting a classifieds listing (backlog K-1) against the local Supabase stack, with the synthetic
// fixture members (scripts/fixtures/members.mts). Posting needs an active membership at any level
// (board-decisions §7); a new listing waits for a moderator, unseen by the public.
const ACTIVE_MEMBER = "marcus.lane@example.com"; // Band, active, phone (479) 555-0119
const LAPSED_MEMBER = "lena.park@example.com"; // Individual, lapsed 14 days ago
const MODERATOR = "dale.ramsey@example.com";
const NEW_LISTING = "/account/listings/new";

// A 1x1 PNG.
const PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A title of this test's own, so tests running at the same time (the two browser projects, and
 * this file's tests in parallel workers) never touch each other's listing.
 */
function listingTitle(testInfo: TestInfo): string {
  return `E2E amp (${testInfo.project.name}, ${testInfo.testId.slice(-8)})`;
}

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

type ListingRow = {
  id: string;
  status: string;
  category: string;
  price: number | null;
  contact_pref: string;
  photo_path: string | null;
};

test("a visitor is sent to sign in first", async ({ page }) => {
  await page.goto(NEW_LISTING);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%2Flistings%2Fnew$/);
});

test("a member whose membership has ended is asked to renew, with no form", async ({ page }) => {
  await signIn(page, LAPSED_MEMBER, NEW_LISTING);
  const main = page.getByRole("main");
  await expect(main).toContainText("Your membership ended on");
  await expect(main.getByRole("link", { name: "Renew your membership" })).toHaveAttribute(
    "href",
    "/join",
  );
  await expect(main.getByLabel("Title")).toHaveCount(0);
});

test("the form moves focus to the field to fix", async ({ page }) => {
  await signIn(page, ACTIVE_MEMBER, NEW_LISTING);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Submit for review" }).click();
  await expect(main.getByLabel("Category")).toBeFocused();
  await expect(main.getByLabel("Category")).toHaveAccessibleDescription("Choose a category.");
});

test.describe("an active member", () => {
  // Remove this run's listing and photo through the Data API and Storage, as the member, if a step
  // failed before the test removed them itself.
  test.afterEach(async ({ request }, testInfo) => {
    const token = await accessToken(request, ACTIVE_MEMBER);
    const rows = await request.get(`${SUPABASE_URL}/rest/v1/listings`, {
      headers: supabaseHeaders(token),
      params: { select: "id,photo_path", title: `eq.${listingTitle(testInfo)}` },
    });
    for (const row of (await rows.json()) as { id: string; photo_path: string | null }[]) {
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

  test("posts a listing with a photo, which waits for a moderator, unseen by the public", async ({
    page,
    request,
  }, testInfo) => {
    const title = listingTitle(testInfo);
    await signIn(page, ACTIVE_MEMBER, NEW_LISTING);
    const main = page.getByRole("main");
    await main.getByLabel("Category").selectOption({ label: "Gear" });
    await main.getByLabel("Title").fill(title);
    await main.getByLabel("Details").fill("Hand-wired, 15 W. Local pickup only.");
    await main.getByLabel("Price (optional)").fill("$650");
    await main.getByLabel("Photo (optional)").setInputFiles({
      name: "amp.png",
      mimeType: "image/png",
      buffer: PHOTO,
    });
    await main.getByLabel("By phone, at (479) 555-0119").check();
    await main.getByRole("button", { name: "Submit for review" }).click();

    await expect(main.getByRole("status")).toContainText(
      `Thanks! “${title}” is waiting for a moderator.`,
    );
    // The form is ready for another listing.
    await expect(main.getByLabel("Title")).toHaveValue("");
    await expect(main.getByLabel("Category")).toHaveValue("");

    // The member sees it, pending, with the photo in their own folder.
    const memberToken = await accessToken(request, ACTIVE_MEMBER);
    const read = (token?: string) =>
      request.get(`${SUPABASE_URL}/rest/v1/listings`, {
        headers: supabaseHeaders(token),
        params: {
          select: "id,status,category,price,contact_pref,photo_path",
          title: `eq.${title}`,
        },
      });
    const [listing] = (await (await read(memberToken)).json()) as ListingRow[];
    expect(listing).toMatchObject({
      status: "pending",
      category: "gear",
      price: 650,
      contact_pref: "phone",
    });
    expect(listing.photo_path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
    const photoUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/listing-photos/${listing.photo_path}`;
    const photo = await request.get(photoUrl, { headers: supabaseHeaders(memberToken) });
    expect(photo.status()).toBe(200);
    expect(Buffer.from(await photo.body()).equals(PHOTO)).toBe(true);

    // The public sees neither the listing nor its photo until a moderator approves it.
    expect(await (await read()).json()).toEqual([]);
    expect((await request.get(photoUrl, { headers: supabaseHeaders() })).ok()).toBe(false);
    const sign = await request.post(
      `${SUPABASE_URL}/storage/v1/object/sign/listing-photos/${listing.photo_path}`,
      { headers: supabaseHeaders(), data: { expiresIn: 60 } },
    );
    expect(sign.ok()).toBe(false);

    // The moderator sees it.
    const moderatorRows = (await (
      await read(await accessToken(request, MODERATOR))
    ).json()) as ListingRow[];
    expect(moderatorRows.map((row) => row.id)).toEqual([listing.id]);
  });
});
