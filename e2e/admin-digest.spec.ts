import { expect, test, type Page } from "@playwright/test";
import { addMonths, monthName, societyMonth } from "../lib/society-time";
import { DOCUMENTS, DRAFT_MARKER, MEMBERS_ONLY_MARKER, POSTS } from "./fixtures/sanity-content.mts";
import { EDITOR, FIXTURE_PASSWORD } from "./support/member-files";
import { openSharedPreviewLink } from "./support/sanity";

// The Monthly digest screen (backlog E-4), with posts from the e2e stand-in for Sanity
// (e2e/fixtures/sanity-content.mts: the posts for everyone and for members, the scheduled post and
// the draft are marked for the digest, the post for Band and up isn't) and the synthetic fixture
// members (scripts/fixtures/members.mts). The fixture editor is an active Individual member, so on
// the blog they read the members' post in full; the digest still gives only its headline.
const MEMBER = "shannon.oneal@example.com"; // an active member without a staff role

// The posts went out 3 days ago: their month on the Society's calendar.
const openPost = DOCUMENTS.find((doc) => doc._id === `post-${POSTS.public.slug}`);
const MONTH = societyMonth(
  new Date(openPost && "publishedAt" in openPost ? openPost.publishedAt : ""),
);
const DIGEST = `/admin/digest?month=${MONTH}`;

async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

/** The page's HTML and its RSC payload, as the signed-in member gets them. */
async function everythingSent(page: Page, path: string): Promise<string> {
  const html = await page.request.get(path);
  const rsc = await page.request.get(path, { headers: { RSC: "1" } });
  expect(html.status()).toBe(200);
  expect(rsc.status()).toBe(200);
  return `${await html.text()}\n${await rsc.text()}`;
}

test("a visitor is sent to sign in first", async ({ page }) => {
  await page.goto("/admin/digest");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fdigest$/);
});

test("members without the Editor role can't make the digest", async ({ page }) => {
  await signIn(page, MEMBER, "/admin/digest");
  const main = page.getByRole("main");
  await expect(main).toContainText("Only editors and administrators can make the monthly digest.");
  await expect(main.getByRole("button", { name: "Copy the newsletter" })).toHaveCount(0);
  expect(await everythingSent(page, DIGEST)).not.toContain(POSTS.public.title);
});

test.describe("an editor", () => {
  test("gets the month's posts and the newsletter, with nothing members-only", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, EDITOR, "/account");
    // The editor's membership lets them read the members' post on the blog...
    await page.goto(`/blog/${POSTS.members.slug}`);
    await expect(page.getByText(MEMBERS_ONLY_MARKER).first()).toBeVisible();

    // ...but the digest goes to everyone.
    await page.goto(DIGEST);
    const main = page.getByRole("main");
    const name = monthName(MONTH);
    const posts = main.getByRole("region", { name: `Posts in the ${name} digest` });
    // Both went out at the same time, so in either order.
    const headlines = posts.getByRole("heading", { level: 3 });
    await expect(headlines).toHaveCount(2);
    expect((await headlines.allInnerTexts()).sort()).toEqual(
      [POSTS.public.title, POSTS.members.title].sort(),
    );
    await expect(posts).toContainText(`The summary of ${POSTS.public.title}.`);
    const membersPost = posts.getByRole("listitem").filter({ hasText: POSTS.members.title });
    await expect(membersPost).toContainText("Members only");
    await expect(membersPost.getByRole("link", { name: POSTS.members.title })).toHaveAttribute(
      "href",
      `/blog/${POSTS.members.slug}`,
    );

    await main.getByRole("button", { name: "Copy the newsletter" }).click();
    await expect(main.getByRole("status")).toHaveText("Copied. Now paste it into MailerLite.");
    const html = await page.evaluate(() => navigator.clipboard.readText());
    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toContain(`<title>${name} at the Ozark Blues Society</title>`);
    expect(html).toContain('href="{$unsubscribe}"');
    expect(html).toContain(`The summary of ${POSTS.public.title}.`);
    expect(html).toContain(`/blog/${POSTS.members.slug}"`);
    for (const missing of [MEMBERS_ONLY_MARKER, POSTS.bandUp.title, POSTS.scheduled.title]) {
      expect(html).not.toContain(missing);
    }

    // The preview on the page is the same newsletter.
    const preview = page.frameLocator(`iframe[title="Preview of the ${name} newsletter"]`);
    await expect(
      preview.getByRole("heading", { level: 1, name: `${name} at the Ozark Blues Society` }),
    ).toBeVisible();
    await expect(preview.getByRole("link", { name: "Unsubscribe" })).toBeVisible();

    // Nothing members-only reaches the page either, and it fits a phone.
    const sent = await everythingSent(page, DIGEST);
    expect(sent).toContain(POSTS.members.title);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("never gets drafts in the digest, even in a preview", async ({ page }) => {
    await signIn(page, EDITOR, "/account");
    // Draft mode on: the blog shows the editor the members' post's draft...
    await openSharedPreviewLink(page, `/blog/${POSTS.members.slug}`);
    await expect(page.getByText(DRAFT_MARKER).first()).toBeVisible();

    // ...but the digest holds only what's published.
    await page.goto(DIGEST);
    await expect(
      page.getByRole("main").getByRole("link", { name: POSTS.members.title, exact: true }),
    ).toBeVisible();
    const sent = await everythingSent(page, DIGEST);
    expect(sent).not.toContain(`${POSTS.members.title} (draft)`);
    expect(sent).not.toContain(DRAFT_MARKER);
  });

  test("chooses another month", async ({ page }) => {
    await signIn(page, EDITOR, "/admin/digest");
    const main = page.getByRole("main");
    // Two months before the posts: no post is in that month's digest.
    const earlier = addMonths(MONTH, -2);
    await main.getByLabel("Month").selectOption(earlier);
    await main.getByRole("button", { name: "Show" }).click();

    await expect(page).toHaveURL(`/admin/digest?month=${earlier}`);
    await expect(main.getByLabel("Month")).toHaveValue(earlier);
    await expect(main).toContainText(
      `No post published in ${monthName(earlier)} is marked “Include in the monthly email digest”. `,
    );
    await expect(main.getByRole("button", { name: "Copy the newsletter" })).toHaveCount(0);
  });
});
