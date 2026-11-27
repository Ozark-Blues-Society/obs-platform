import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  MEMBERS_ONLY_MARKER,
  PAGES,
  PAGE_FILE_CODE,
  POSTS,
  UNKNOWN_BLOCK_MARKER,
} from "./fixtures/sanity-content.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";

// Pages built in the Studio (backlog C-2), from the e2e stand-in for Sanity
// (e2e/fixtures/sanity-content.mts), in the desktop and phone (390px) projects: each template, the
// blocks, and members-only pages for a visitor, a member, and members at other levels, with the
// synthetic fixture members (scripts/fixtures/members.mts).
const MEMBERS = {
  // an active Individual member;
  individual: "shannon.oneal@example.com",
  // an active Band member.
  band: "tasha.moore@example.com",
};

const SITE_TITLE = "Ozark Blues Society";

// Nothing leaves the machine: the photos' Sanity CDN addresses and the video players fail at once,
// as if offline. Loopback stays open for the site and the stand-in.
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

test.describe("a visitor", () => {
  test("reads a Standard page, every block in the Society's design", async ({ page }) => {
    const response = await page.goto(`/${PAGES.standard.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${PAGES.standard.title} · ${SITE_TITLE}`);
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { level: 1, name: PAGES.standard.title })).toBeVisible();
    await expect(main.getByText("E2E intro for the standard page.")).toBeVisible();
    await expect(main.getByText("Members only", { exact: true })).toHaveCount(0);

    await expect(
      main.getByRole("heading", { level: 2, name: "E2E heading in the text" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "the events calendar" })).toHaveAttribute(
      "href",
      "/events",
    );
    // The photo comes from Sanity's image CDN, sized for the screen.
    await expect(main.getByRole("img", { name: "E2E band on stage" })).toHaveAttribute(
      "src",
      /^https:\/\/cdn\.sanity\.io\/images\/e2estandin\/[\w-]+\/e2eStagePhoto1-1600x900\.jpg\?/,
    );
    await expect(main.getByText("E2E photo caption")).toBeVisible();
    await expect(main.locator('iframe[title="E2E video"]')).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    await expect(main.getByText("E2E video caption")).toBeVisible();
    await expect(main.getByRole("table", { name: "E2E venues" })).toBeVisible();
    // Only a Directory page's tables have a search box.
    await expect(main.getByRole("searchbox")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "E2E read the open post" })).toHaveAttribute(
      "href",
      `/blog/${POSTS.public.slug}`,
    );
    await expect(main.getByText("E2E pull quote")).toBeVisible();
    await expect(page.getByText(UNKNOWN_BLOCK_MARKER)).toHaveCount(0);
    await expectNoSidewaysScroll(page);
  });

  test("gets a Band Spotlight page that opens with its hero", async ({ page }) => {
    await page.goto(`/${PAGES.spotlight.slug}`);
    await expect(page).toHaveTitle(`${PAGES.spotlight.title} · ${SITE_TITLE}`);
    const main = page.getByRole("main");
    // The hero's headline is the page's heading, under the template's name.
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(PAGES.spotlight.hero);
    await expect(main.getByText("Band Spotlight", { exact: true })).toBeVisible();
    await expect(main.getByText("E2E hero text")).toBeVisible();
    await expect(main.getByRole("img", { name: "E2E hero photo" })).toHaveAttribute(
      "src",
      /^https:\/\/cdn\.sanity\.io\/images\/e2estandin\//,
    );
    await expect(main.getByRole("link", { name: "E2E hero button" })).toHaveAttribute(
      "href",
      "/events",
    );
    await expect(main.getByText("E2E spotlight quote")).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test("gets a members-only page's header and a lock, and nothing members-only is sent", async ({
    page,
    request,
  }) => {
    const path = `/${PAGES.members.slug}`;
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: PAGES.members.title })).toBeVisible();
    await expect(main.getByText("E2E intro for members, public like the title.")).toBeVisible();
    await expect(main.getByText("Members only", { exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "This page is for members" })).toBeVisible();
    // The lock's own Sign in brings the visitor back here (the header has another).
    await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(path)}`,
    );

    const sent = await everythingSent(request, path);
    expect(sent).toContain(PAGES.members.title);
    for (const membersOnly of [
      MEMBERS_ONLY_MARKER,
      "E2E members-only text",
      "E2E booking venues",
      "E2E Bluebird Lounge",
      "E2E booking guide",
      PAGE_FILE_CODE,
    ]) {
      expect(sent).not.toContain(membersOnly);
    }
  });

  test("gets the header and a lock for a page whose hero is members-only too", async ({
    page,
    request,
  }) => {
    const path = `/${PAGES.bandUp.slug}`;
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: PAGES.bandUp.title })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This page is for Band, Business and Sponsor members" }),
    ).toBeVisible();
    const sent = await everythingSent(request, path);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    expect(sent).not.toContain(PAGES.bandUp.hero);
    expect(sent).not.toContain("e2eBandPhoto1");
  });

  test("is told an address has no page, whether no page has it or none could", async ({
    page,
    request,
  }) => {
    for (const path of ["/e2e-no-such-page", "/E2E_Not_A_Page"]) {
      await page.goto(path);
      await expect(page.getByText("This page could not be found.")).toBeVisible();
      // The page streams, so its status is already 200 when the address turns out to have no
      // page. Next.js adds noindex instead, so search engines don't list it.
      expect(await (await request.get(path)).text()).toContain(
        '<meta name="robots" content="noindex"/>',
      );
    }
  });
});

test.describe("a member", () => {
  test("reads a members-only Directory page, searches its table and sees its files", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.individual);
    await page.goto(`/${PAGES.members.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByText(`E2E members-only text. ${MEMBERS_ONLY_MARKER}`)).toBeVisible();
    // The page header's tag comes first; each file in the list has its own.
    await expect(main.getByText("Members only", { exact: true }).first()).toBeVisible();
    await expect(main.getByRole("heading", { name: "This page is for members" })).toHaveCount(0);

    const table = main.getByRole("table", { name: "E2E booking venues" });
    await expect(table.getByRole("row")).toHaveCount(3);
    await main.getByRole("searchbox", { name: "Search E2E booking venues" }).fill("bluebird");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("rowheader")).toHaveText("E2E Bluebird Lounge");
    await expect(main.getByText("Showing 1 of 2")).toBeVisible();

    const files = main.getByRole("region", { name: "Files for members" });
    await expect(files.getByRole("link", { name: "E2E booking guide (PDF)" })).toHaveAttribute(
      "href",
      `/files/${PAGE_FILE_CODE}`,
    );
    await expectNoSidewaysScroll(page);
  });

  test("at another level is told whom a page is for, and gets none of it", async ({ page }) => {
    await signIn(page, MEMBERS.individual);
    const path = `/${PAGES.bandUp.slug}`;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "This page is for Band, Business and Sponsor members" }),
    ).toBeVisible();
    await expect(page.getByText("It isn't part of your membership level.")).toBeVisible();
    const sent = await everythingSent(page.request, path);
    expect(sent).not.toContain(MEMBERS_ONLY_MARKER);
    expect(sent).not.toContain(PAGES.bandUp.hero);
  });

  test("at a listed level gets the page, opening with its hero marked Members only", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.band);
    await page.goto(`/${PAGES.bandUp.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: PAGES.bandUp.hero })).toBeVisible();
    await expect(main.getByText("Members only", { exact: true })).toBeVisible();
    await expect(main.getByText("Band Spotlight", { exact: true })).toBeVisible();
    await expect(main.getByText(`E2E band quote. ${MEMBERS_ONLY_MARKER}`)).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
});
