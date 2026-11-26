import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceholderPhoto } from "@/components/ui/placeholder-photo";
import { HomeHero } from "./home-hero";
import { MembershipCta } from "./membership-cta";
import { SponsorBand } from "./sponsor-band";

const NEXT = {
  title: "Friday Blues Jam",
  href: "/events/friday-blues-jam",
  // 01:00 UTC on Dec 19 is 7 PM on Dec 18 in Central Time.
  startsAt: "2026-12-19T01:00:00Z",
  venue: "The Riverside Tap",
};

describe("HomeHero", () => {
  it("has the page's level-1 heading and both calls to action", () => {
    render(
      <HomeHero
        heading="Live music, local players."
        eyebrow="A community nonprofit"
        intro="Concerts and jams."
        primaryAction={{ label: "Become a Member", href: "/join" }}
        secondaryAction={{ label: "See Upcoming Shows", href: "/events" }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Live music, local players.",
    );
    expect(screen.getByRole("link", { name: "Become a Member" })).toHaveAttribute("href", "/join");
    expect(screen.getByRole("link", { name: "See Upcoming Shows" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(screen.queryByRole("region", { name: "Next up" })).not.toBeInTheDocument();
  });

  it("shows the next event in the Society's time zone, with a link naming the event", () => {
    render(
      <HomeHero
        heading="Live music"
        primaryAction={{ label: "Join", href: "/join" }}
        nextEvent={NEXT}
      />,
    );
    const nextUp = screen.getByRole("region", { name: "Next up" });

    expect(within(nextUp).getByRole("heading", { level: 3 })).toHaveTextContent("Friday Blues Jam");
    expect(within(nextUp).getByText("Dec")).toBeInTheDocument();
    expect(within(nextUp).getByText("18")).toBeInTheDocument();
    expect(within(nextUp).getByText(/The Riverside Tap · 7:00/)).toBeInTheDocument();
    expect(within(nextUp).getByRole("link", { name: "Details: Friday Blues Jam" })).toHaveAttribute(
      "href",
      "/events/friday-blues-jam",
    );
  });

  it("leaves the venue out when there is none to show", () => {
    render(
      <HomeHero
        heading="Live music"
        primaryAction={{ label: "Join", href: "/join" }}
        nextEvent={{ ...NEXT, venue: undefined }}
      />,
    );
    expect(screen.queryByText(/Riverside/)).not.toBeInTheDocument();
  });

  it("keeps the background photo away from screen readers", () => {
    const { container } = render(
      <HomeHero
        heading="Live music"
        primaryAction={{ label: "Join", href: "/join" }}
        photo={<PlaceholderPhoto />}
      />,
    );
    expect(container.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("SponsorBand", () => {
  it("spotlights the featured sponsor above every sponsor's logo", () => {
    render(
      <SponsorBand
        featured={{
          name: "Riverbend Brewing Co.",
          href: "https://example.com/",
          blurb: "Hosts our open jam.",
        }}
        sponsors={[{ name: "Riverbend Brewing Co." }, { name: "Old Mill Music Hall" }]}
      />,
    );
    const band = screen.getByRole("region", { name: "Our sponsors" });

    expect(within(band).getByText("Featured sponsor")).toBeInTheDocument();
    expect(
      within(band).getByRole("heading", { level: 3, name: "Sponsor spotlight" }),
    ).toBeVisible();
    expect(within(band).getByText("Hosts our open jam.")).toBeInTheDocument();
    expect(
      within(band).getByRole("link", { name: /Visit Riverbend Brewing Co\./ }),
    ).toHaveAttribute("href", "https://example.com/");
    expect(
      within(band)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Riverbend Brewing Co.", "Old Mill Music Hall"]);
    expect(within(band).getByRole("link", { name: /Become a sponsor/ })).toHaveAttribute(
      "href",
      "/sponsors",
    );
  });

  it("works without a featured sponsor", () => {
    render(<SponsorBand sponsors={[{ name: "Old Mill Music Hall" }]} />);
    expect(screen.queryByText("Featured sponsor")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Old Mill Music Hall");
  });
});

describe("MembershipCta", () => {
  it("asks visitors to join", () => {
    render(
      <MembershipCta
        heading="Membership starts at $30 a year."
        text="Members-only events and more."
        action={{ label: "See membership benefits", href: "/join" }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Membership starts at $30 a year." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See membership benefits" })).toHaveAttribute(
      "href",
      "/join",
    );
  });
});
