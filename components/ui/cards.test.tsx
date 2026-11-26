import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventCard } from "./event-card";
import { LockOverlay } from "./lock-overlay";
import { PostCard } from "./post-card";
import { SponsorLogo } from "./sponsor-logo";

describe("EventCard", () => {
  it("shows the date, time, tags, venue and prices in the Society's time zone", () => {
    render(
      <EventCard
        title="Delta Night: Mavis Crane Band"
        href="/events/delta-night"
        startsAt="2026-12-05T02:00:00Z"
        category="Concert"
        repeats="weekly"
        membersOnly
        venue="Old Mill Music Hall"
        price="$15"
        memberPrice="$10"
      />,
    );

    const card = screen.getByRole("article");
    // 02:00 UTC on Dec 5 is 8 PM on Dec 4 in Central Time.
    const badge = card.querySelector("time");
    expect(badge).toHaveAttribute("dateTime", "2026-12-05T02:00:00.000Z");
    expect(badge).toHaveTextContent("Dec4");
    expect(card).toHaveTextContent("Old Mill Music Hall · 8:00 PM");
    expect(card).toHaveTextContent("$15 · Members $10");
    expect(within(card).getByText("Members only")).toBeInTheDocument();
    expect(within(card).getByText("Concert")).toBeInTheDocument();
    expect(within(card).getByText("Weekly")).toBeInTheDocument();
  });

  it("links its title, as a heading, to the event", () => {
    render(<EventCard title="Blues Jam" href="/events/jam" startsAt="2026-07-01T23:00:00Z" />);

    const heading = screen.getByRole("heading", { level: 3, name: "Blues Jam" });
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/events/jam");
    // Summer time: 23:00 UTC is 6 PM in Central Daylight Time.
    expect(screen.getByRole("article")).toHaveTextContent("6:00 PM");
  });

  it("leaves out what it isn't given", () => {
    render(<EventCard title="Blues Jam" href="/events/jam" startsAt="2026-07-01T23:00:00Z" />);

    const card = screen.getByRole("article");
    expect(card).not.toHaveTextContent("·");
    expect(card).not.toHaveTextContent("Members");
  });
});

describe("PostCard", () => {
  it("shows the category, date, title and excerpt", () => {
    render(
      <PostCard
        title="Fall Fest Recap"
        href="/blog/fall-fest-recap"
        publishedAt="2026-10-14T15:00:00Z"
        category="Recap"
        excerpt="Two days, eleven bands."
      />,
    );

    const card = screen.getByRole("article");
    expect(screen.getByRole("link", { name: "Fall Fest Recap" })).toHaveAttribute(
      "href",
      "/blog/fall-fest-recap",
    );
    expect(card).toHaveTextContent("Recap");
    expect(card).toHaveTextContent("Oct 14, 2026");
    expect(card).toHaveTextContent("Two days, eleven bands.");
    expect(card).not.toHaveTextContent("Members only");
  });

  it("shows a locked post's headline and a members-only note, never an excerpt", () => {
    render(
      <PostCard
        title="Board Notes — October"
        href="/blog/board-notes-october"
        publishedAt="2026-10-03T15:00:00Z"
        locked
      />,
    );

    const card = screen.getByRole("article");
    expect(screen.getByRole("heading", { name: "Board Notes — October" })).toBeInTheDocument();
    expect(within(card).getByText("Members only")).toBeInTheDocument();
    expect(
      within(card).getByText("This post is for members. Sign in or join to read it."),
    ).toBeInTheDocument();
    // The blurred sentence is a stand-in, hidden from screen readers.
    const standIn = within(card).getByText(/can read this post when they sign in/);
    expect(standIn).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SponsorLogo", () => {
  it("shows the name until there's a logo, linked to the sponsor's website", () => {
    render(<SponsorLogo name="Old Mill Music Hall" href="https://example.com/old-mill" />);
    expect(screen.getByRole("link", { name: "Old Mill Music Hall" })).toHaveAttribute(
      "href",
      "https://example.com/old-mill",
    );
  });

  it("shows the logo, except for a name-only placement", () => {
    const logo = <svg role="img" aria-label="Riverbend Brewing Co." />;
    const { rerender } = render(<SponsorLogo name="Riverbend Brewing Co." logo={logo} />);
    expect(screen.getByRole("img", { name: "Riverbend Brewing Co." })).toBeInTheDocument();

    rerender(<SponsorLogo name="Riverbend Brewing Co." logo={logo} placement="name" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Riverbend Brewing Co.")).toBeInTheDocument();
  });
});

describe("LockOverlay", () => {
  it("offers Sign in and Join over a placeholder that holds no content", () => {
    const { container } = render(
      <LockOverlay
        description="Sign in to see the venue directory."
        signInHref="/sign-in?next=/venue-directory"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "This page is for members" }),
    ).toBeVisible();
    expect(screen.getByText("Sign in to see the venue directory.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=/venue-directory",
    );
    expect(screen.getByRole("link", { name: "Join now" })).toHaveAttribute("href", "/join");
    const placeholder = container.querySelector('[aria-hidden="true"].blur-xs');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveTextContent("");
  });
});
