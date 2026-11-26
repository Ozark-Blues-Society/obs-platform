import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  DRAFT_MARKER,
  MEMBERS_ONLY_MARKER,
  MEMBER_FILE_CODE,
  POSTS,
} from "./fixtures/sanity-content.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";
import { enterDraftMode } from "./support/sanity";

// Members-only gating of content (backlog M-7, decision 0001), on blog posts from the e2e stand-in
// for Sanity (e2e/fixtures/sanity-content.mts), with the synthetic fixture members
// (scripts/fixtures/members.mts):
const MEMBERS = {
  // an active Individual member: may read members' posts, not the one for Band and up;
  individual: "shannon.oneal@example.com",
  // an active Band member;
  band: "tasha.moore@example.com",
  // an Individual member whose membership ended 14 days ago.
  lapsed: "lena.park@example.com",
};

const postUrl = (slug: string) => `/blog/${slug}`;

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=%2Faccount");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

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

test.describe("a visitor", () => {
  test("reads a post for everyone", async ({ page }) => {
    await page.goto(postUrl(POSTS.public.slug));
    await expect(page.getByRole("heading", { level: 1, name: POSTS.public.title })).toBeVisible();
    await expect(page.getByText(`The post ${POSTS.public.title} in full.`)).toBeVisible();
  });

  test("gets the headline and a lock for a members-only post, and nothing members-only is sent", async ({
    page,
    request,
  }) => {
    const path = postUrl(POSTS.members.slug);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: POSTS.members.title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This post is for members" })).toBeVisible();
    // The lock's own Sign in brings the visitor back here (the header has another).
    await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(path)}`,
    );

    const sent = await everythingSent(request, path);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    expect(sent).not.toContain(`The summary of ${POSTS.members.title}`);
    expect(sent).not.toContain(MEMBER_FILE_CODE);
    expect(sent).not.toContain("E2E minutes");
  });

  test("never sees a scheduled post before its date, or a post that doesn't exist", async ({
    page,
  }) => {
    for (const slug of [POSTS.scheduled.slug, "no-such-post"]) {
      await page.goto(postUrl(slug));
      await expect(page.getByText("This page could not be found.")).toBeVisible();
      await expect(page.getByRole("heading", { name: POSTS.scheduled.title })).toHaveCount(0);
    }
  });

  test("gets none of a members-only post right after a member has read it", async ({
    page,
    request,
  }) => {
    // The member's visit fills the server's cache for their level...
    await signIn(page, MEMBERS.individual);
    const path = postUrl(POSTS.members.slug);
    await page.goto(path);
    await expect(page.getByText(MEMBERS_ONLY_MARKER).first()).toBeVisible();

    // ...and a visitor asking straight after gets their own answer, with nothing members-only.
    const html = await request.get(path);
    expect(html.headers()["cache-control"]).toContain("private");
    expect(html.headers()["cache-control"]).toContain("no-store");
    const sent = await everythingSent(request, path);
    expect(sent).toContain(POSTS.members.title);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
  });
});

test.describe("a member", () => {
  test("reads a members-only post and its files, and a file is asked for only when clicked", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.individual);
    // Each request for /files/<code>. Any such request makes the server ask Storage for a
    // download link, so it must come from a click, never from a prefetch (as next/link would do).
    const fileRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/files/")) fileRequests.push(request.url());
    });

    await page.goto(postUrl(POSTS.members.slug));
    await expect(page.getByText(`The post ${POSTS.members.title} in full.`)).toBeVisible();
    const files = page.getByRole("region", { name: "Files for members" });
    const link = files.getByRole("link", { name: "E2E minutes (PDF)" });
    await expect(link).toHaveAttribute("href", `/files/${MEMBER_FILE_CODE}`);
    await expect(page.getByRole("heading", { name: "This post is for members" })).toHaveCount(0);

    // On screen and hovered, but not clicked: nothing asks for the file. A prefetch would start
    // within moments of the link showing, so absence is checked after a short wait.
    await link.hover();
    await page.waitForTimeout(1_500);
    expect(fileRequests).toEqual([]);

    // Clicked: the browser asks /files/<code> once, and the route checks the member. This file has
    // no row, so the member is told it isn't available.
    await link.click();
    await expect(
      page.getByRole("heading", { level: 1, name: /^This file isn.t available to you$/ }),
    ).toBeVisible();
    expect(fileRequests).toHaveLength(1);
  });

  test("at another level is told whom a post is for, and gets none of it", async ({ page }) => {
    await signIn(page, MEMBERS.individual);
    const path = postUrl(POSTS.bandUp.slug);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "This post is for Band, Business and Sponsor members" }),
    ).toBeVisible();
    await expect(page.getByText("It isn't part of your membership level.")).toBeVisible();
    expect(await everythingSent(page.request, path)).not.toContain(MEMBERS_ONLY_MARKER);
  });

  test("at a listed level reads the post", async ({ page }) => {
    await signIn(page, MEMBERS.band);
    await page.goto(postUrl(POSTS.bandUp.slug));
    await expect(page.getByText(`The post ${POSTS.bandUp.title} in full.`)).toBeVisible();
  });

  test("whose membership has ended is asked to renew, and gets none of it", async ({ page }) => {
    await signIn(page, MEMBERS.lapsed);
    const path = postUrl(POSTS.members.slug);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Your membership has ended" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Renew" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(await everythingSent(page.request, path)).not.toContain(MEMBERS_ONLY_MARKER);
  });
});

test.describe("a preview (draft mode)", () => {
  test("never unlocks a members-only post for a visitor, drafts included", async ({
    page,
    context,
    baseURL,
  }) => {
    await enterDraftMode(context, baseURL!);
    const path = postUrl(POSTS.members.slug);
    await page.goto(path);
    // The draft's headline shows, so the preview is on...
    await expect(page.getByRole("heading", { level: 1 })).toContainText("(draft)");
    // ...but the post stays locked.
    await expect(page.getByRole("heading", { name: "This post is for members" })).toBeVisible();
    const sent = await everythingSent(page.request, path);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    expect(sent).not.toContain(DRAFT_MARKER);
  });

  test("shows a member the draft of a post they may read", async ({ page, context, baseURL }) => {
    await signIn(page, MEMBERS.individual);
    await enterDraftMode(context, baseURL!);
    await page.goto(postUrl(POSTS.members.slug));
    await expect(page.getByText(DRAFT_MARKER).first()).toBeVisible();
  });
});
