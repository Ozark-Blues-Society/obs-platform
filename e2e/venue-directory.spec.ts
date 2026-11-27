import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  BOOKING_CONTACT_MARKER,
  DIRECTORY,
  DIRECTORY_MARKER,
  PAGES,
} from "./fixtures/sanity-content.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";
import { openSharedPreviewLink } from "./support/sanity";

// The venue directory (backlog M-9, decision 0001, board-decisions §1), from the e2e stand-in for
// Sanity (e2e/fixtures/sanity-content.mts), in the desktop and phone (390px) projects. It sits on
// a page open to everyone, so these tests show that the directory gates itself: rows for members
// with an active membership, booking contacts for Band, Business and Sponsor members only, and
// none of it sent to anyone else, in the HTML or the RSC payload. The members are the synthetic
// fixture members (scripts/fixtures/members.mts).
const MEMBERS = {
  // an active Individual member;
  individual: "shannon.oneal@example.com",
  // active Band, Business and Sponsor members;
  band: "tasha.moore@example.com",
  business: "grace.holloway@example.com",
  sponsor: "margaret.sloan@example.com",
  // a Band member whose membership ended 120 days ago.
  lapsed: "cole.barrett@example.com",
};

const PATH = `/${PAGES.venues.slug}`;

/** What only Band, Business and Sponsor members may get. */
const CONTACTS = [
  BOOKING_CONTACT_MARKER,
  DIRECTORY.contact.email,
  DIRECTORY.contact.phone,
  DIRECTORY.desk.name,
  DIRECTORY.desk.email,
];
/** What only members with an active membership may get, contacts aside. */
const ROWS = [DIRECTORY_MARKER, ...Object.values(DIRECTORY.venues), "E2E backline drum kit"];

// Nothing leaves the machine. Loopback stays open for the site and the stand-in.
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

/**
 * Everything the server sends for the page: its HTML, and the RSC payload a navigation fetches.
 * `request` carries the cookies of whoever is asking.
 */
async function everythingSent(request: APIRequestContext): Promise<string> {
  const html = await request.get(PATH);
  const rsc = await request.get(PATH, { headers: { RSC: "1" } });
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

test("a visitor gets the page with a lock where the directory is, and none of it", async ({
  page,
  request,
}) => {
  await page.goto(PATH);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: PAGES.venues.title })).toBeVisible();
  await expect(main.getByText("E2E text for everyone, above the directory.")).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: DIRECTORY.heading })).toBeVisible();
  await expect(
    main.getByRole("heading", { level: 3, name: "This directory is for members" }),
  ).toBeVisible();
  // The lock's own Sign in brings the visitor back here (the header has another).
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    `/sign-in?next=${encodeURIComponent(PATH)}`,
  );
  await expect(main.getByRole("table")).toHaveCount(0);

  const sent = await everythingSent(request);
  expect(sent).toContain("E2E text for everyone, above the directory.");
  for (const membersOnly of [...ROWS, ...CONTACTS]) expect(sent).not.toContain(membersOnly);
  await expectNoSidewaysScroll(page);
});

test("an Individual member gets the venues and their details, and no booking contacts", async ({
  page,
}) => {
  await signIn(page, MEMBERS.individual);
  await page.goto(PATH);
  const main = page.getByRole("main");
  const table = main.getByRole("table", { name: DIRECTORY.heading });
  await expect(table.getByRole("columnheader")).toHaveText(["Venue", "Capacity", "Pays", "Notes"]);
  // By name, and never the entry that has no venue yet.
  await expect(table.getByRole("rowheader")).toHaveText([
    DIRECTORY.venues.courthouse,
    DIRECTORY.venues.jukeJoint,
    DIRECTORY.venues.riverbend,
  ]);
  await expect(
    table.getByRole("row", { name: new RegExp(DIRECTORY.venues.jukeJoint) }).getByRole("cell"),
  ).toHaveText(["150", `E2E door split ${DIRECTORY_MARKER}`, "E2E backline drum kit"]);
  await expect(
    main.getByText(/^Booking contacts are for Band, Business and Sponsor members\./),
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Compare membership levels" })).toHaveAttribute(
    "href",
    "/join",
  );

  await main.getByRole("searchbox", { name: "Search the directory" }).fill("patio");
  await expect(table.getByRole("rowheader")).toHaveText([DIRECTORY.venues.riverbend]);
  await expect(main.getByText("Showing 1 of 3")).toBeVisible();
  await expectNoSidewaysScroll(page);

  const sent = await everythingSent(page.request);
  // The rows reach the member...
  for (const row of ROWS) expect(sent).toContain(row);
  // ...but not the contacts, or the entry with no venue.
  for (const contact of CONTACTS) expect(sent).not.toContain(contact);
  expect(sent).not.toContain(DIRECTORY.unfinished);
});

test("Band, Business and Sponsor members also get each venue's booking contact", async ({
  page,
}) => {
  for (const email of [MEMBERS.band, MEMBERS.business, MEMBERS.sponsor]) {
    await page.context().clearCookies();
    await signIn(page, email);
    await page.goto(PATH);
    const main = page.getByRole("main");
    const table = main.getByRole("table", { name: DIRECTORY.heading });
    await expect(table.getByRole("columnheader"), email).toHaveText([
      "Venue",
      "Booking contact",
      "Capacity",
      "Pays",
      "Notes",
    ]);
    await expect(
      table.getByRole("row", { name: new RegExp(DIRECTORY.venues.jukeJoint) }).getByRole("cell"),
    ).toHaveText([
      `${DIRECTORY.contact.name} · ${DIRECTORY.contact.email} · ${DIRECTORY.contact.phone}`,
      "150",
      `E2E door split ${DIRECTORY_MARKER}`,
      "E2E backline drum kit",
    ]);
    await expect(main.getByText(/Booking contacts are for/)).toHaveCount(0);
  }

  // The search looks in the contacts too.
  const main = page.getByRole("main");
  await main.getByRole("searchbox", { name: "Search the directory" }).fill("events desk");
  await expect(main.getByRole("table").getByRole("rowheader")).toHaveText([
    DIRECTORY.venues.riverbend,
  ]);
  await expectNoSidewaysScroll(page);
  const sent = await everythingSent(page.request);
  for (const contact of CONTACTS) expect(sent).toContain(contact);
  expect(sent).not.toContain(DIRECTORY.unfinished);
});

test("a member whose membership has ended is asked to renew, and gets none of it", async ({
  page,
}) => {
  await signIn(page, MEMBERS.lapsed);
  await page.goto(PATH);
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 3, name: "Your membership has ended" }),
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Renew" })).toHaveAttribute("href", "/join");
  await expect(main.getByRole("table")).toHaveCount(0);
  const sent = await everythingSent(page.request);
  for (const membersOnly of [...ROWS, ...CONTACTS]) expect(sent).not.toContain(membersOnly);
});

test("a shared preview link doesn't open the directory to a visitor", async ({ page }) => {
  await openSharedPreviewLink(page, PATH);
  // The draft's title shows, so the preview is on...
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(draft)");
  await expect(page.getByRole("heading", { name: "This directory is for members" })).toBeVisible();
  // ...and page.request carries the preview's cookie, so the server answered with drafts.
  const sent = await everythingSent(page.request);
  expect(sent).toContain("(draft)");
  for (const membersOnly of [...ROWS, ...CONTACTS]) expect(sent).not.toContain(membersOnly);
});
