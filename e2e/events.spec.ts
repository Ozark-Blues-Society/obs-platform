import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { repeatText } from "../lib/events/describe";
import { readSchedule, upcomingOccurrences } from "../lib/events/occurrences";
import {
  eventDateParts,
  formatCalendarDate,
  formatSocietyLongDate,
  formatSocietyShortDate,
} from "../lib/society-time";
import { EVENTS, VENUES } from "./fixtures/sanity-events.mts";
import { MEMBERS_ONLY_MARKER } from "./fixtures/sanity-content.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";

// The events calendar (backlog P-2): event pages and "Add to calendar", on events from the e2e
// stand-in for Sanity (e2e/fixtures/sanity-events.mts), with the synthetic fixture members
// (scripts/fixtures/members.mts). Every test runs on a desktop and on a 390px phone.
const MEMBERS = {
  // an active Individual member: sees every members-only event;
  individual: "shannon.oneal@example.com",
  // an Individual member whose membership ended 14 days ago.
  lapsed: "lena.park@example.com",
};

const eventUrl = (slug: string) => `/events/${slug}`;
const calendarUrl = (slug: string) => `/events/${slug}/calendar.ics`;

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in?next=%2Faccount");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill(email);
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

/** The page's HTML and the RSC payload a client-side navigation fetches, as `request` sees them. */
async function everythingSent(request: APIRequestContext, path: string): Promise<string> {
  const html = await request.get(path);
  const rsc = await request.get(path, { headers: { RSC: "1" } });
  expect(html.status()).toBe(200);
  expect(rsc.status()).toBe(200);
  return `${await html.text()}\n${await rsc.text()}`;
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

const details = (page: Page) => page.getByRole("region", { name: "Event details" });

/** A calendar file's text with its folded lines joined again (RFC 5545), so no value is split. */
async function calendarText(request: APIRequestContext, slug: string): Promise<string> {
  const response = await request.get(calendarUrl(slug));
  expect(response.status()).toBe(200);
  return (await response.text()).replace(/\r\n /g, "");
}

test.describe("a visitor", () => {
  test("sees an event's date, place and prices, and adds it to a calendar", async ({
    page,
    request,
  }) => {
    const { slug, title, start } = EVENTS.concert;
    await page.goto(eventUrl(slug));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} · Ozark Blues Society`);
    const facts = details(page);
    await expect(facts).toContainText(
      `${formatSocietyLongDate(start)} · ${eventDateParts(start).time}`,
    );
    await expect(facts).toContainText(VENUES.open.name);
    await expect(facts).toContainText(VENUES.open.address);
    await expect(facts.getByRole("link", { name: "Map and directions" })).toHaveAttribute(
      "href",
      VENUES.open.mapUrl,
    );
    await expect(facts).toContainText("$15 · Members $10");
    await expect(facts).not.toContainText("Your member price");
    await expect(page.getByText(`The ${title} in full.`)).toBeVisible();
    await expectNoSidewaysScroll(page);

    const add = facts.getByRole("link", { name: "Add to calendar" });
    await expect(add).toHaveAttribute("href", calendarUrl(slug));
    const file = await request.get(calendarUrl(slug));
    expect(file.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(file.headers()["content-disposition"]).toBe(`attachment; filename="${slug}.ics"`);
    const text = (await file.text()).replace(/\r\n /g, "");
    expect(text).toContain(`SUMMARY:${title}\r\n`);
    expect(text).toContain(
      `LOCATION:${VENUES.open.name}\\, ${VENUES.open.address.replace(",", "\\,")}`,
    );
    expect(text).toMatch(/\r\nURL:http:\/\/localhost:\d+\/events\/e2e-open-concert\r\n/);
  });

  test("gets the title, date and a lock for a members-only event, and nothing members-only is sent", async ({
    page,
    request,
  }) => {
    const { slug, title } = EVENTS.social;
    const path = eventUrl(slug);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("main").getByText("Members only", { exact: true })).toBeVisible();
    await expect(details(page)).toContainText("Location visible to members");
    await expect(details(page).getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "This event is for members" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(path)}`,
    );
    await expectNoSidewaysScroll(page);

    expect(await everythingSent(request, path)).not.toContain(MEMBERS_ONLY_MARKER);
    const file = await calendarText(request, slug);
    expect(file).toContain(`SUMMARY:${title} (members only)`);
    expect(file).not.toContain(MEMBERS_ONLY_MARKER);
    expect(file).not.toContain("LOCATION:");
  });

  test("sees how a weekly event repeats, and its next dates", async ({ page }) => {
    const { slug, start, until } = EVENTS.jam;
    const schedule = readSchedule(start, { frequency: "weekly", until })!;
    await page.goto(eventUrl(slug));
    const facts = details(page);
    await expect(facts).toContainText(`${repeatText(schedule)}, ${eventDateParts(start).time}`);
    await expect(facts).toContainText(`Until ${formatCalendarDate(until)}`);
    const next = upcomingOccurrences(schedule, new Date(), 4);
    await expect(facts.getByRole("listitem")).toHaveText(
      next.map((date) => formatSocietyShortDate(date)),
    );
    await expect(facts.getByRole("link", { name: "Add to calendar" })).toBeVisible();
  });

  test("is told an event is over, with nothing to add to a calendar", async ({ page }) => {
    await page.goto(eventUrl(EVENTS.past.slug));
    await expect(details(page)).toContainText("This event is over.");
    await expect(details(page).getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
  });

  test("gets a not-found page for an event that doesn't exist", async ({ page, request }) => {
    await page.goto(eventUrl("no-such-event"));
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    expect((await request.get(calendarUrl("no-such-event"))).status()).toBe(404);
  });
});

test.describe("a member", () => {
  test("sees a members-only event's place and description, and adds it to a calendar", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.individual);
    const { slug, title } = EVENTS.social;
    await page.goto(eventUrl(slug));
    await expect(page.getByText(`The ${title} in full. ${MEMBERS_ONLY_MARKER}`)).toBeVisible();
    await expect(details(page)).toContainText(VENUES.secret.name);
    await expect(page.getByRole("heading", { name: "This event is for members" })).toHaveCount(0);
    const file = await calendarText(page.request, slug);
    expect(file).toContain(`SUMMARY:${title}\r\n`);
    expect(file).toContain(`LOCATION:${VENUES.secret.name}`);
  });

  test("sees their member price highlighted", async ({ page }) => {
    await signIn(page, MEMBERS.individual);
    await page.goto(eventUrl(EVENTS.concert.slug));
    await expect(details(page).getByText("Your member price: $10")).toBeVisible();
  });

  test("whose membership has ended is asked to renew, and gets none of a members-only event", async ({
    page,
  }) => {
    await signIn(page, MEMBERS.lapsed);
    const path = eventUrl(EVENTS.social.slug);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Your membership has ended" })).toBeVisible();
    expect(await everythingSent(page.request, path)).not.toContain(MEMBERS_ONLY_MARKER);
    // No member price for a membership that has ended.
    await page.goto(eventUrl(EVENTS.concert.slug));
    await expect(details(page)).not.toContainText("Your member price");
  });
});
