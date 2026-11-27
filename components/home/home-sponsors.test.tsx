import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentSponsor } from "@/sanity/content/sponsors";
import { HomeSponsors } from "./home-sponsors";

const listCurrentSponsors = vi.hoisted(() =>
  vi.fn<(ids: readonly string[]) => Promise<CurrentSponsor[]>>(),
);
// The featured pick is the real one; only the read from Sanity is replaced.
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

const NAME_ONLY = {
  id: "tier-friend",
  name: "Friend",
  logoPlacement: "name" as const,
  benefits: [],
};

const SPONSORS: CurrentSponsor[] = [
  {
    id: "sp-old-mill",
    name: "Old Mill Music Hall",
    featured: true,
    blurb: "Featured first, and never turned off.",
    updatedAt: "2026-11-01T10:00:00Z",
  },
  {
    id: "sp-riverbend",
    name: "Riverbend Brewing Co.",
    website: "https://riverbend.example.com/",
    logo: {
      image: { asset: { _ref: "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-400x100-png" } },
      alt: "Riverbend Brewing Co. logo",
    },
    featured: true,
    blurb: "Riverbend has hosted our Tuesday Open Jam for six years.",
    updatedAt: "2026-11-20T10:00:00Z",
  },
  {
    id: "sp-second-spin",
    name: "Second Spin Records",
    logo: {
      image: { asset: { _ref: "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-400x100-png" } },
      alt: "Second Spin Records logo",
    },
    tier: NAME_ONLY,
  },
];

describe("HomeSponsors", () => {
  beforeEach(() => listCurrentSponsors.mockReset());

  it("shows the featured sponsor's spotlight and every current sponsor", async () => {
    listCurrentSponsors.mockResolvedValueOnce(SPONSORS);
    render(await HomeSponsors());

    expect(listCurrentSponsors).toHaveBeenCalledWith([]);
    const band = screen.getByRole("region", { name: "Our sponsors" });
    // The one changed most recently, as on the Sponsors page.
    expect(
      within(band).getByRole("heading", { level: 3, name: "Sponsor spotlight" }),
    ).toBeInTheDocument();
    expect(within(band).getByText(SPONSORS[1].blurb!)).toBeInTheDocument();
    expect(within(band).queryByText(SPONSORS[0].blurb!)).not.toBeInTheDocument();

    // Every current sponsor, with its logo when it has one: the home page shows logos whatever
    // the tier's placement on the Sponsors page.
    const logos = within(band).getAllByRole("listitem");
    expect(logos.map((item) => item.textContent || item.querySelector("img")?.alt)).toEqual([
      "Old Mill Music Hall",
      "Riverbend Brewing Co. logo",
      "Second Spin Records logo",
    ]);
    expect(within(band).getAllByRole("link", { name: "Riverbend Brewing Co. logo" })).toHaveLength(
      1,
    );
    expect(within(band).getByRole("link", { name: /Become a sponsor/ })).toHaveAttribute(
      "href",
      "/sponsors",
    );
  });

  it("draws nothing when no sponsor is current", async () => {
    listCurrentSponsors.mockResolvedValueOnce([]);
    const { container } = render(await HomeSponsors());

    expect(container).toBeEmptyDOMElement();
  });
});
