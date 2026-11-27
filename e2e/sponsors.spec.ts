import { expect, test, type Page } from "@playwright/test";
import { SPONSORS, SPONSORS_PAGE } from "./fixtures/sanity-content.mts";

// The Sponsors page and the home page's sponsor band (backlog P-4), from the e2e stand-in for
// Sanity (e2e/fixtures/sanity-content.mts), in the desktop and phone (390px) projects. Sponsors are
// public, so a visitor sees all of it.

// Nothing leaves the machine: the logos' Sanity CDN addresses fail at once, as if offline.
// Loopback stays open for the site and the stand-in.
test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
    (route) => route.abort(),
  );
});

/** Featured sponsors whose spotlight must never show: one changed earlier, one that has ended. */
const NOT_IN_THE_SPOTLIGHT = [
  SPONSORS_PAGE.featuredBefore.blurb,
  SPONSORS_PAGE.featuredEnded.blurb,
];

function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("the Sponsors page shows the featured sponsor, then the current sponsors by tier", async ({
  page,
}) => {
  await page.goto("/sponsors");
  await expect(page).toHaveTitle("Sponsors · Ozark Blues Society");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Our Sponsors");

  // One spotlight: Riverbend's, the featured sponsor changed most recently among the current ones.
  await expect(main.getByText(SPONSORS.current.blurb)).toBeVisible();
  await expect(main.getByRole("heading", { name: "Sponsor spotlight" })).toHaveCount(1);
  await expect(main.getByRole("link", { name: `Visit ${SPONSORS.current.name}` })).toHaveAttribute(
    "href",
    `${SPONSORS.current.website}/`,
  );
  for (const text of NOT_IN_THE_SPOTLIGHT) await expect(page.getByText(text)).toHaveCount(0);

  // The tiers in their order from the Studio (not by name), each with its price and benefits.
  await expect(main.getByRole("heading", { level: 2 })).toHaveText([
    "Sponsor spotlight",
    SPONSORS_PAGE.tier.name,
    SPONSORS_PAGE.friendTier.name,
    "Become a sponsor",
  ]);
  const tier = main.getByRole("region", { name: SPONSORS_PAGE.tier.name });
  await expect(
    tier.getByText(`${SPONSORS_PAGE.tier.price} · ${SPONSORS_PAGE.tier.benefit}`),
  ).toBeVisible();
  // A logo, its alt text naming the link to the sponsor's website, or the name until there's one.
  await expect(tier.getByRole("link", { name: SPONSORS.current.logoAlt })).toHaveAttribute(
    "href",
    `${SPONSORS.current.website}/`,
  );
  await expect(tier.getByText(SPONSORS.noLogo.name)).toBeVisible();
  await expect(tier.getByText(SPONSORS_PAGE.featuredBefore.name)).toBeVisible();

  // A tier of names only: the sponsor's logo doesn't show.
  const friends = main.getByRole("region", { name: SPONSORS_PAGE.friendTier.name });
  await expect(friends.getByText(SPONSORS_PAGE.friendTier.benefit)).toBeVisible();
  await expect(friends.getByRole("link", { name: SPONSORS_PAGE.friend.name })).toHaveAttribute(
    "href",
    `${SPONSORS_PAGE.friend.website}/`,
  );
  await expect(friends.getByText(SPONSORS_PAGE.longName.name)).toBeVisible();
  await expect(friends.getByRole("img")).toHaveCount(0);

  // Gone by themselves the day after their sponsorship ended, featured or not.
  await expect(page.getByText(SPONSORS.ended.name)).toHaveCount(0);
  await expect(page.getByText(SPONSORS_PAGE.featuredEnded.name)).toHaveCount(0);

  // Sponsor is a membership level, so becoming one starts at Membership Benefits & Join.
  await expect(main.getByRole("link", { name: "Join as a sponsor" })).toHaveAttribute(
    "href",
    "/join",
  );

  // The long name wraps rather than making a phone scroll sideways.
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("the home page shows the same spotlight and every current sponsor", async ({ page }) => {
  await page.goto("/");
  const band = page.getByRole("region", { name: "Our sponsors" });

  await expect(band.getByText(SPONSORS.current.blurb)).toBeVisible();
  await expect(band.getByRole("heading", { level: 3, name: "Sponsor spotlight" })).toBeVisible();
  for (const text of NOT_IN_THE_SPOTLIGHT) await expect(page.getByText(text)).toHaveCount(0);

  // Every current sponsor's logo, whatever its tier's placement on the Sponsors page, or its name.
  await expect(band.getByRole("link", { name: SPONSORS.current.logoAlt })).toHaveAttribute(
    "href",
    `${SPONSORS.current.website}/`,
  );
  await expect(band.getByRole("link", { name: SPONSORS_PAGE.friend.logoAlt })).toHaveAttribute(
    "href",
    `${SPONSORS_PAGE.friend.website}/`,
  );
  await expect(band.getByText(SPONSORS.noLogo.name)).toBeVisible();
  await expect(band.getByText(SPONSORS_PAGE.longName.name)).toBeVisible();
  await expect(page.getByText(SPONSORS.ended.name)).toHaveCount(0);
  await expect(page.getByText(SPONSORS_PAGE.featuredEnded.name)).toHaveCount(0);

  await expect(band.getByRole("link", { name: /Become a sponsor/ })).toHaveAttribute(
    "href",
    "/sponsors",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
