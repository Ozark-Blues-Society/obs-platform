import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentSponsor } from "@/sanity/content/sponsors";
import { CurrentSponsors } from "./current-sponsors";

const listCurrentSponsors = vi.hoisted(() =>
  vi.fn<(ids: readonly string[]) => Promise<CurrentSponsor[]>>(),
);
vi.mock("@/sanity/content/sponsors", () => ({ listCurrentSponsors }));
// next-sanity's <Image> builds Sanity CDN addresses; here it shows what it was given instead.
vi.mock("next-sanity/image", () => ({
  Image: (props: { alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} className={props.className} />
  ),
}));

const LOGO = { image: { asset: { _ref: "image-Tb9Ew8CXIwaY6R1kjMvI0uRR-400x100-png" } } };

describe("CurrentSponsors", () => {
  beforeEach(() => listCurrentSponsors.mockReset());

  it("shows each sponsor's logo or name, linking to its website", async () => {
    listCurrentSponsors.mockResolvedValueOnce([
      {
        id: "sp-1",
        name: "Riverbend Brewing Co.",
        website: "https://riverbend.example.com/",
        logo: { ...LOGO, alt: "Riverbend Brewing Co. logo" },
      },
      { id: "sp-2", name: "Hilltop Guitar Works" },
    ]);
    render(
      await CurrentSponsors({
        heading: "Presented with our sponsors",
        sponsorIds: ["sp-1", "sp-2"],
      }),
    );

    expect(listCurrentSponsors).toHaveBeenCalledWith(["sp-1", "sp-2"]);
    expect(
      screen.getByRole("heading", { level: 2, name: "Presented with our sponsors" }),
    ).toBeInTheDocument();
    const logo = screen.getByRole("img", { name: "Riverbend Brewing Co. logo" });
    expect(logo).toHaveClass("h-10");
    expect(screen.getByRole("link", { name: "Riverbend Brewing Co. logo" })).toHaveAttribute(
      "href",
      "https://riverbend.example.com/",
    );
    // No logo yet, and no website: the name, not a link.
    expect(screen.getByText("Hilltop Guitar Works").tagName).toBe("SPAN");
  });

  it("draws nothing when no sponsor is current", async () => {
    listCurrentSponsors.mockResolvedValueOnce([]);
    const { container } = render(
      await CurrentSponsors({ heading: "Our sponsors", sponsorIds: [] }),
    );
    expect(container).toBeEmptyDOMElement();
    expect(listCurrentSponsors).toHaveBeenCalledWith([]);
  });
});
