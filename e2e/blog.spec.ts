import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { AUTHOR, MEMBERS_ONLY_MARKER, POSTS } from "./fixtures/sanity-content.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";
import { openSharedPreviewLink } from "./support/sanity";

// The blog (backlog P-3), with posts from the e2e stand-in for Sanity
// (e2e/fixtures/sanity-content.mts), in the desktop and phone (390px) projects: the list and its
// category filter, a post with its cover photo, text and author, scheduled posts, and members-only
// posts for a visitor and a member. e2e/members-only-items.spec.ts covers the post page's locks in
// depth, and the synthetic fixture members are in scripts/fixtures/members.mts.

/** An active Individual member: may read members' posts, not the one for Band and up. */
const INDIVIDUAL = "shannon.oneal@example.com";

/** Every post that's out, latest first. The scheduled one isn't, and the draft is a preview's. */
const LISTED = [
  POSTS.recap.title,
  POSTS.bandUp.title,
  POSTS.members.title,
  POSTS.public.title,
  POSTS.education.title,
];

// Nothing leaves the machine: the photos' Sanity CDN addresses fail at once, as if offline.
// Loopback stays open for the site and the stand-in.
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) => route.abort(),
  );
});

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=%2Faccount");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
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

const headlines = (page: Page) =>
  page.getByRole("main").getByRole("article").getByRole("heading", { level: 2 });
const card = (page: Page, title: string) =>
  page.getByRole("main").getByRole("article").filter({ hasText: title });

test.describe("a visitor", () => {
  test("gets the posts that are out, latest first, members-only ones locked", async ({
    page,
    request,
  }) => {
    const response = await page.goto("/blog");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Blog · Ozark Blues Society");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "The Blog" })).toBeVisible();
    await expect(headlines(page)).toHaveText(LISTED);

    // A post for everyone: its summary, category and date, linked to the post.
    const open = card(page, POSTS.public.title);
    await expect(open.getByText(`The summary of ${POSTS.public.title}.`)).toBeVisible();
    await expect(open.getByText("Society News")).toBeVisible();
    await expect(open.getByRole("link", { name: POSTS.public.title })).toHaveAttribute(
      "href",
      `/blog/${POSTS.public.slug}`,
    );
    await expect(open.getByText("Members only")).toHaveCount(0);

    // A members-only post: the headline and the tag, and a blurred stand-in for the summary.
    for (const title of [POSTS.members.title, POSTS.bandUp.title]) {
      const locked = card(page, title);
      await expect(locked.getByText("Members only")).toBeVisible();
      await expect(
        locked.getByText("This post is for members. Sign in or join to read it."),
      ).toBeAttached();
    }

    // The recap's cover photo, from Sanity's image CDN, as decoration beside its headline.
    const cover = card(page, POSTS.recap.title).locator("img");
    await expect(cover).toHaveAttribute("src", /^https:\/\/cdn\.sanity\.io\/images\/e2estandin\//);
    await expect(cover).toHaveAttribute("alt", "");

    // Nothing members-only and nothing scheduled is sent, in the HTML or the RSC payload.
    const sent = await everythingSent(request, "/blog");
    expect(sent).toContain(POSTS.members.title);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    expect(sent).not.toContain(`The summary of ${POSTS.members.title}`);
    expect(sent).not.toContain(POSTS.scheduled.title);
    await expectNoSidewaysScroll(page);
  });

  test("filters the blog by category, each filter at its own address", async ({ page }) => {
    await page.goto("/blog");
    const categories = page.getByRole("navigation", { name: "Blog categories" });
    const status = page.getByRole("main").getByRole("status");
    await expect(status).toHaveText(`${LISTED.length} posts.`);
    await expect(categories.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await categories.getByRole("link", { name: "Recap" }).click();
    await expect(page).toHaveURL(/\/blog\?category=recap$/);
    await expect(page).toHaveTitle("Recap · Blog · Ozark Blues Society");
    // Screen readers hear what the list now holds, from a status line.
    await expect(status).toHaveText("1 Recap post.");
    await expect(categories.getByRole("link", { name: "Recap" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(categories.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
    await expect(headlines(page)).toHaveText([POSTS.recap.title]);

    await categories.getByRole("link", { name: "Society News" }).click();
    await expect(page).toHaveURL(/\/blog\?category=society-news$/);
    await expect(headlines(page)).toHaveText([
      POSTS.bandUp.title,
      POSTS.members.title,
      POSTS.public.title,
    ]);

    await categories.getByRole("link", { name: "Band Spotlight" }).click();
    await expect(status).toHaveText("No Band Spotlight posts yet. See all posts");
    await expect(status).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "See all posts" }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(headlines(page)).toHaveText(LISTED);

    // An address opens its filter straight away, and one for no such category shows every post.
    await page.goto("/blog?category=education");
    await expect(headlines(page)).toHaveText([POSTS.education.title]);
    await page.goto("/blog?category=gear&page=7");
    await expect(page).toHaveTitle("Page 7 · Blog · Ozark Blues Society");
    await expect(headlines(page)).toHaveText(LISTED);
  });

  test("reads a post: the cover photo, the formatted text and the author", async ({ page }) => {
    await page.goto("/blog");
    await page.getByRole("link", { name: POSTS.recap.title }).click();
    await expect(page).toHaveURL(`/blog/${POSTS.recap.slug}`);
    await expect(page).toHaveTitle(`${POSTS.recap.title} · Ozark Blues Society`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: POSTS.recap.title })).toBeVisible();
    await expect(main.getByText(/^Recap · \w{3} \d{1,2}, \d{4}$/)).toBeVisible();
    await expect(main.getByRole("img", { name: "E2E recap cover photo" })).toHaveAttribute(
      "src",
      /^https:\/\/cdn\.sanity\.io\/images\/e2estandin\//,
    );

    const article = main.getByRole("article");
    await expect(article.getByText(`The summary of ${POSTS.recap.title}.`)).toBeVisible();
    await expect(article.getByText(`By ${AUTHOR.name}`)).toBeVisible();
    await expect(article.getByText(`The post ${POSTS.recap.title} in full.`)).toBeVisible();
    await expect(
      article.getByRole("heading", { level: 2, name: "E2E recap highlights" }),
    ).toBeVisible();
    await expect(article.getByRole("listitem")).toHaveText([
      "E2E first highlight",
      "E2E second highlight",
    ]);
    await expect(article.getByRole("link", { name: "the events calendar" })).toHaveAttribute(
      "href",
      "/events",
    );
    await expect(article.getByRole("img", { name: "E2E photo in the recap" })).toHaveAttribute(
      "src",
      /^https:\/\/cdn\.sanity\.io\/images\/e2estandin\//,
    );
    await expect(article.getByText("E2E caption")).toBeVisible();
    // Under the post, the author from People.
    await expect(article.getByText(`${AUTHOR.name} · ${AUTHOR.role}`)).toBeVisible();
    await expect(article.getByText(AUTHOR.bio)).toBeVisible();
    await expectNoSidewaysScroll(page);

    await main.getByRole("link", { name: "All posts" }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(headlines(page)).toHaveText(LISTED);
  });

  test("never gets a scheduled post: not on the blog, at its address or in a tab title", async ({
    page,
    request,
  }) => {
    const path = `/blog/${POSTS.scheduled.slug}`;
    await page.goto(path);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page).not.toHaveTitle(new RegExp(POSTS.scheduled.title));
    expect(await everythingSent(request, path)).not.toContain(POSTS.scheduled.title);

    await page.goto("/blog");
    await expect(headlines(page)).toHaveText(LISTED);
    await expect(page.getByText(POSTS.scheduled.title)).toHaveCount(0);
  });
});

test.describe("a member", () => {
  test("gets the summaries of members' posts, and a lock on a post for other levels", async ({
    page,
  }) => {
    await signIn(page, INDIVIDUAL);
    await page.goto("/blog");
    await expect(headlines(page)).toHaveText(LISTED);

    const members = card(page, POSTS.members.title);
    await expect(members.getByText("Members only")).toBeVisible();
    await expect(members.getByText(`The summary of ${POSTS.members.title}.`)).toBeVisible();

    const bandUp = card(page, POSTS.bandUp.title);
    await expect(bandUp.getByText("Members only")).toBeVisible();
    await expect(bandUp.getByText(`The summary of ${POSTS.bandUp.title}`)).toHaveCount(0);

    // page.request carries the member's session: the members' summary is sent, the other not.
    const sent = await everythingSent(page.request, "/blog");
    expect(sent).toContain(`The summary of ${POSTS.members.title}.`);
    expect(sent).not.toContain(`The summary of ${POSTS.bandUp.title}`);
  });
});

test.describe("a preview (draft mode)", () => {
  test("lists the scheduled post and the drafts, which the blog doesn't show yet", async ({
    page,
  }) => {
    await openSharedPreviewLink(page, "/blog");
    // The scheduled post is the latest. (The draft's date is a moment after the others' from the
    // same day, so their order isn't checked here.)
    await expect(headlines(page).first()).toHaveText(POSTS.scheduled.title);
    await expect(headlines(page)).toHaveCount(LISTED.length + 1);
    await expect(card(page, `${POSTS.members.title} (draft)`)).toHaveCount(1);
    // A visitor's preview still locks the members' post.
    await expect(card(page, POSTS.members.title).getByText("Members only")).toBeVisible();
    expect(await everythingSent(page.request, "/blog")).not.toContain(MEMBERS_ONLY_MARKER);
  });
});
