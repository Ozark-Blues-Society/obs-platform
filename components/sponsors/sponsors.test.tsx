import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentSponsor, SponsorTier } from "@/sanity/content/sponsors";
import { BecomeASponsor } from "./become-a-sponsor";
import { CurrentSponsorsByTier } from "./current-sponsors-by-tier";
import { SponsorTiers, tierDetails } from "./sponsor-tiers";

const listCurrentSponsors = vi.hoisted(() =>
  vi.fn<(ids: readonly string[]) => Promise<CurrentSponsor[]>>(),
);
// The featured pick and the grouping are the real ones; only the read from Sanity is replaced.
vi.mock("@/sanity/content/sponsors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/sanity/content/sponsors")>()),
  listCurrentSponsors,
}));
// next-sanity/live only runs in React Server Components (see sanity/live.test.ts).
vi.mock("@/sanity/live", () => ({ sanityFetch: vi.fn(), getDynamicFetchOptions: vi.fn() }));
// next-sanity's <Image> builds Sanity CDN addresses; here it shows what it was given instead.
vi.mock("next-sanity/image", () => ({
  Image: (props: { alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} className={props.className} />
  ),
}));

const logo = (alt: string) => ({
  image: { asset: { _ref: "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-400x100-png" } },
  alt,
});

const HEADLINER: SponsorTier = {
  id: "tier-headliner",
  name: "Headliner",
  logoPlacement: "large",
  sortOrder: 1,
  pricePerYear: 1000,
  benefits: ["Large logo on the Sponsors page", "Home page spotlight"],
};
const SPONSOR: SponsorTier = {
  id: "tier-sponsor",
  name: "Sponsor",
  logoPlacement: "logo",
  sortOrder: 2,
  pricePerYear: 500,
  benefits: [],
};
const FRIEND: SponsorTier = {
  id: "tier-friend",
  name: "Friend",
  logoPlacement: "name",
  sortOrder: 3,
  benefits: ["Name on the Sponsors page"],
};

const RIVERBEND: CurrentSponsor = {
  id: "sp-riverbend",
  name: "Riverbend Brewing Co.",
  website: "https://riverbend.example.com/",
  logo: logo("Riverbend Brewing Co. logo"),
  tier: HEADLINER,
  featured: true,
  blurb: "Riverbend has hosted our Tuesday Open Jam for six years.",
  updatedAt: "2026-11-20T10:00:00Z",
};
const OLD_MILL: CurrentSponsor = {
  id: "sp-old-mill",
  name: "Old Mill Music Hall",
  tier: SPONSOR,
  // Featured before Riverbend was, and never turned off: Riverbend changed more recently.
  featured: true,
  blurb: "The best room in town.",
  updatedAt: "2026-11-01T10:00:00Z",
};
const SECOND_SPIN: CurrentSponsor = {
  id: "sp-second-spin",
  name: "Second Spin Records",
  website: "https://secondspin.example.com/",
  logo: logo("Second Spin Records logo"),
  tier: FRIEND,
};
const UNTIERED: CurrentSponsor = { id: "sp-untiered", name: "Aardvark Audio" };

describe("tierDetails", () => {
  it("gives the price a year and the benefits", () => {
    expect(tierDetails(HEADLINER)).toBe(
      "$1,000 a year · Large logo on the Sponsors page · Home page spotlight",
    );
    expect(tierDetails(SPONSOR)).toBe("$500 a year");
    expect(tierDetails(FRIEND)).toBe("Name on the Sponsors page");
    expect(tierDetails({ ...SPONSOR, pricePerYear: 0 })).toBe("");
  });
});

describe("SponsorTiers", () => {
  it("shows each tier's sponsors as its logo placement says, linking to their websites", () => {
    render(
      <SponsorTiers
        groups={[
          { tier: HEADLINER, sponsors: [RIVERBEND] },
          { tier: SPONSOR, sponsors: [OLD_MILL] },
          { tier: FRIEND, sponsors: [SECOND_SPIN] },
          { sponsors: [UNTIERED] },
        ]}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Headliner",
      "Sponsor",
      "Friend",
      "Other sponsors",
    ]);

    // A large logo, with its alt text naming the link.
    const headliner = screen.getByRole("region", { name: "Headliner" });
    expect(
      within(headliner).getByText(
        "$1,000 a year · Large logo on the Sponsors page · Home page spotlight",
      ),
    ).toBeInTheDocument();
    expect(within(headliner).getByRole("img", { name: "Riverbend Brewing Co. logo" })).toHaveClass(
      "h-14",
    );
    expect(
      within(headliner).getByRole("link", { name: "Riverbend Brewing Co. logo" }),
    ).toHaveAttribute("href", "https://riverbend.example.com/");

    // No logo yet and no website: the name, not a link.
    const sponsorTier = screen.getByRole("region", { name: "Sponsor" });
    expect(within(sponsorTier).getByText("Old Mill Music Hall").tagName).toBe("SPAN");
    expect(within(sponsorTier).queryByRole("link")).not.toBeInTheDocument();

    // Names only, even for a sponsor with a logo.
    const friend = screen.getByRole("region", { name: "Friend" });
    expect(within(friend).queryByRole("img")).not.toBeInTheDocument();
    expect(within(friend).getByRole("link", { name: "Second Spin Records" })).toHaveAttribute(
      "href",
      "https://secondspin.example.com/",
    );

    const other = screen.getByRole("region", { name: "Other sponsors" });
    expect(within(other).getByText("Aardvark Audio")).toBeInTheDocument();
  });
});

describe("CurrentSponsorsByTier", () => {
  beforeEach(() => listCurrentSponsors.mockReset());

  it("shows one featured sponsor's spotlight, then every current sponsor by tier", async () => {
    // As the loader orders them: by tier, then by name.
    listCurrentSponsors.mockResolvedValueOnce([RIVERBEND, OLD_MILL, SECOND_SPIN]);
    render(await CurrentSponsorsByTier());

    expect(listCurrentSponsors).toHaveBeenCalledWith([]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Sponsor spotlight",
      "Headliner",
      "Sponsor",
      "Friend",
    ]);
    // Riverbend's spotlight, not Old Mill's, though both are featured.
    expect(screen.getByText(RIVERBEND.blurb!)).toBeInTheDocument();
    expect(screen.queryByText(OLD_MILL.blurb!)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visit Riverbend Brewing Co\./ })).toHaveAttribute(
      "href",
      "https://riverbend.example.com/",
    );
    // The spotlight's logo sits on white, so a dark logo shows on its dark panel.
    const logos = screen.getAllByRole("img", { name: "Riverbend Brewing Co. logo" });
    expect(logos).toHaveLength(2);
    expect(logos[0].parentElement).toHaveClass("bg-white");
  });

  it("shows no spotlight when no sponsor is featured", async () => {
    listCurrentSponsors.mockResolvedValueOnce([{ ...OLD_MILL, featured: undefined }, SECOND_SPIN]);
    render(await CurrentSponsorsByTier());

    expect(screen.queryByRole("heading", { name: "Sponsor spotlight" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Sponsor",
      "Friend",
    ]);
  });

  it("says so when no sponsor is current", async () => {
    listCurrentSponsors.mockResolvedValueOnce([]);
    render(await CurrentSponsorsByTier());

    expect(screen.getByText("No sponsors are listed right now.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("BecomeASponsor", () => {
  it("sends sponsors to Membership Benefits & Join", () => {
    render(<BecomeASponsor />);

    expect(
      screen.getByRole("region", { name: "Become a sponsor" }).querySelector("h2"),
    ).toHaveTextContent("Become a sponsor");
    expect(screen.getByRole("link", { name: "Join as a sponsor" })).toHaveAttribute(
      "href",
      "/join",
    );
  });
});
