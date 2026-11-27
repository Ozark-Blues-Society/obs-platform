import { expect, test, type Page } from "@playwright/test";
import { readSchedule, occurrencesBetween } from "../lib/events/occurrences";
import {
  addMonths,
  monthName,
  monthRange,
  societyMonth,
  societyWallClock,
} from "../lib/society-time";
import { MEMBERS_ONLY_MARKER } from "./fixtures/sanity-content.mts";
import { EVENTS, VENUES } from "./fixtures/sanity-events.mts";
import { FIXTURE_PASSWORD } from "./support/member-files";

// The events calendar (backlog P-2): the month grid and the list, category filters, "Coming up"
// and the subscribable feed, on events from the e2e stand-in for Sanity
// (e2e/fixtures/sanity-events.mts). Every test runs on a desktop and on a 390px phone.

/** The month an event date falls in on the Society's calendar. */
const monthOf = (instant: string) => societyMonth(new Date(instant));
/** The day of the month an event date falls on in the Society's calendar. */
const dayOf = (instant: string) => String(societyWallClock(new Date(instant)).day);

const grid = (page: Page, month: string) => page.getByRole("table", { name: monthName(month) });
/** The grid cell for a day of the month, found by its number. */
const cell = (page: Page, month: string, day: string) =>
  grid(page, month)
    .getByRole("cell")
    .filter({ has: page.getByText(day, { exact: true }) });
const comingUp = (page: Page) => page.getByRole("complementary", { name: "Coming up" });

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

test("the calendar opens on this month and moves to the months before and after", async ({
  page,
}) => {
  const thisMonth = societyMonth(new Date());
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
  await expect(page).toHaveTitle(`Events in ${monthName(thisMonth)} · Ozark Blues Society`);
  await expect(page.getByRole("heading", { level: 2, name: monthName(thisMonth) })).toBeVisible();
  await expect(grid(page, thisMonth).getByRole("columnheader")).toHaveText([
    "SunSunday",
    "MonMonday",
    "TueTuesday",
    "WedWednesday",
    "ThuThursday",
    "FriFriday",
    "SatSaturday",
  ]);
  await expectNoSidewaysScroll(page);

  const next = addMonths(thisMonth, 1);
  await page.getByRole("link", { name: `Next month, ${monthName(next)}` }).click();
  await expect(page).toHaveURL(`/events?month=${next}`);
  await expect(page.getByRole("heading", { level: 2, name: monthName(next) })).toBeVisible();
  await expect(page).toHaveTitle(`Events in ${monthName(next)} · Ozark Blues Society`);

  await page.getByRole("link", { name: `Previous month, ${monthName(thisMonth)}` }).click();
  await expect(page).toHaveURL(`/events?month=${thisMonth}`);
  await expect(grid(page, thisMonth)).toBeVisible();
});

test("the month grid puts each date on its day, a repeating event on every one", async ({
  page,
}) => {
  const { start, until, title } = EVENTS.jam;
  const month = monthOf(EVENTS.concert.start);
  await page.goto(`/events?month=${month}`);

  const concert = cell(page, month, dayOf(EVENTS.concert.start));
  await expect(concert.getByRole("link", { name: EVENTS.concert.title })).toHaveAttribute(
    "href",
    `/events/${EVENTS.concert.slug}`,
  );

  // Every date of the weekly jam in this month, and nothing on other days.
  const { start: from, end: to } = monthRange(month);
  const jamDates = occurrencesBetween(
    readSchedule(start, { frequency: "weekly", until })!,
    from,
    to,
  );
  await expect(grid(page, month).getByRole("link", { name: title })).toHaveCount(jamDates.length);
  for (const date of jamDates) {
    await expect(
      cell(page, month, dayOf(date.toISOString())).getByRole("link", { name: title }),
    ).toHaveCount(1);
  }
});

test("a visitor sees a members-only event on the calendar, locked, without its place", async ({
  page,
  request,
}) => {
  const { start, title, slug } = EVENTS.social;
  const month = monthOf(start);
  await page.goto(`/events?month=${month}`);
  const link = cell(page, month, dayOf(start)).getByRole("link", {
    name: `${title}, members only`,
  });
  await expect(link).toHaveAttribute("href", `/events/${slug}`);

  const card = comingUp(page).getByRole("article").filter({ hasText: title });
  await expect(card).toContainText("Members only");
  await expect(card).toContainText("Location visible to members");

  const html = await (await request.get(`/events?month=${month}`)).text();
  expect(html).not.toContain(MEMBERS_ONLY_MARKER);
  expect(html).not.toContain(VENUES.secret.address);
});

test("the category filters narrow the grid and Coming up, and the address keeps them", async ({
  page,
}) => {
  const month = monthOf(EVENTS.concert.start);
  await page.goto(`/events?month=${month}`);
  const filters = page.getByRole("group", { name: "Event category" });
  await expect(filters.getByRole("button", { name: "All" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await filters.getByRole("button", { name: "Jam" }).click();
  await expect(filters.getByRole("button", { name: "Jam" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(`/events?month=${month}&category=jam`);
  await expect(grid(page, month).getByRole("link", { name: EVENTS.concert.title })).toHaveCount(0);
  await expect(comingUp(page).getByText(EVENTS.concert.title)).toHaveCount(0);
  await expect(comingUp(page).getByText(EVENTS.jam.title)).toBeVisible();

  // The next month keeps the filter; going back to "All" shows the concert again.
  const next = addMonths(month, 1);
  await page.getByRole("link", { name: `Next month, ${monthName(next)}` }).click();
  await expect(page).toHaveURL(`/events?month=${next}&category=jam`);
  await expect(
    page.getByRole("group", { name: "Event category" }).getByRole("button", { name: "Jam" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(`/events?month=${month}&category=jam`);
  await page
    .getByRole("group", { name: "Event category" })
    .getByRole("button", { name: "All" })
    .click();
  await expect(page).toHaveURL(`/events?month=${month}`);
  await expect(grid(page, month).getByRole("link", { name: EVENTS.concert.title })).toBeVisible();
});

test("the list view shows the month's dates as cards, and moves between months", async ({
  page,
}) => {
  const month = monthOf(EVENTS.concert.start);
  await page.goto(`/events?month=${month}`);
  await page
    .getByRole("group", { name: "Show the calendar as" })
    .getByRole("button", { name: "List" })
    .click();
  await expect(page).toHaveURL(`/events?month=${month}&view=list`);
  await expect(page.getByRole("table")).toHaveCount(0);
  const list = page.getByRole("region", { name: monthName(month) });
  const card = list.getByRole("article").filter({ hasText: EVENTS.concert.title });
  await expect(card).toContainText(VENUES.open.name);
  await expect(card).toContainText("$15 · Members $10");
  await expectNoSidewaysScroll(page);

  const next = addMonths(month, 1);
  await page.getByRole("link", { name: `Next month, ${monthName(next)}` }).click();
  await expect(page).toHaveURL(`/events?month=${next}&view=list`);
  await expect(page.getByRole("region", { name: monthName(next) })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("Coming up lists each event once, at its next date, with the calendar feed's links", async ({
  page,
  baseURL,
}) => {
  await page.goto("/events");
  const list = comingUp(page);
  // The weekly jam once, though it repeats; the past show not at all.
  await expect(list.getByRole("article").filter({ hasText: EVENTS.jam.title })).toHaveCount(1);
  await expect(list.getByText(EVENTS.past.title)).toHaveCount(0);
  await expect(list.getByRole("article").first()).toContainText(EVENTS.jam.title);

  const feed = `${baseURL}/events/feed.ics`;
  const webcal = feed.replace(/^http:/, "webcal:");
  await expect(list.getByRole("link", { name: "Apple Calendar" })).toHaveAttribute("href", webcal);
  await expect(list.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
    "href",
    `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  );
  await expect(list.getByRole("link", { name: "Outlook" })).toHaveAttribute(
    "href",
    `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=Ozark+Blues+Society+events`,
  );
  await expect(list.getByRole("link", { name: feed })).toHaveAttribute("href", feed);
});

test("the feed holds every event, members-only ones without their details, whoever asks", async ({
  page,
}) => {
  // Signed in as an active member: the feed is the same as a visitor's.
  await page.goto("/sign-in?next=%2Faccount");
  const form = page.getByRole("region", { name: "Sign in with a password" });
  await form.getByLabel("Email address").fill("shannon.oneal@example.com");
  await form.getByLabel("Password").fill(FIXTURE_PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  const response = await page.request.get("/events/feed.ics");
  expect(response.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
  expect(response.headers()["cache-control"]).toBe("public, max-age=3600");
  const file = (await response.text()).replace(/\r\n /g, "");
  expect(file).toContain("X-WR-CALNAME:Ozark Blues Society events\r\n");
  for (const { title } of [EVENTS.concert, EVENTS.jam, EVENTS.past]) {
    expect(file).toContain(`SUMMARY:${title}\r\n`);
  }
  expect(file).toContain(`SUMMARY:${EVENTS.social.title} (members only)\r\n`);
  expect(file).toMatch(/RRULE:FREQ=WEEKLY;UNTIL=\d{8}T\d{6}Z\r\n/);
  expect(file).not.toContain(MEMBERS_ONLY_MARKER);
});
