import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import BandSpotlightPreview from "./band-spotlight/page";
import DirectoryIndividualPreview from "./directory/individual/page";
import DirectoryContactsPreview from "./directory/page";
import DirectoryVisitorPreview from "./directory/visitor/page";
import HomePreview from "./home/page";
import DesignPreviewOverview from "./page";
import PromoFeaturePreview from "./promo-feature/page";
import { DIRECTORY, PREVIEW_PAGES } from "./sample-content";
import StandardPreview from "./standard/page";

const PAGES: [string, ComponentType, string][] = [
  ["the overview", DesignPreviewOverview, "Overview"],
  ["home", HomePreview, "Home"],
  ["the Standard page", StandardPreview, "Standard"],
  ["the Directory page", DirectoryContactsPreview, "Directory"],
  ["the Band Spotlight page", BandSpotlightPreview, "Band Spotlight"],
  ["the Promo Feature page", PromoFeaturePreview, "Promo Feature"],
];

const CONTACTS = DIRECTORY.rows.map((row) => row[DIRECTORY.contactColumn]);

describe("design preview pages", () => {
  // The site layout supplies the <main> landmark (app/(site)/layout.tsx).
  it.each(PAGES)("%s has one level-1 heading and no main landmark", (_, Page) => {
    render(<Page />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it.each(PAGES)(
    "%s says it's a preview and marks itself in the preview links",
    (_, Page, label) => {
      render(<Page />);
      const bar = screen.getByRole("navigation", { name: "Design preview" });

      expect(within(bar).getByText("Design preview with sample content.")).toBeInTheDocument();
      expect(within(bar).getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const [pages] = within(bar).getAllByRole("list");
      expect(within(pages).getAllByRole("link")).toHaveLength(Object.keys(PREVIEW_PAGES).length);
    },
  );

  it("the home page's members-only post shows no summary, and its event no venue", () => {
    render(<HomePreview />);

    const post = screen.getByRole("link", { name: "Board Notes: November" }).closest("article")!;
    expect(within(post).getByText("Members only")).toBeInTheDocument();
    const event = screen.getByRole("link", { name: "Members’ Holiday Social" }).closest("article")!;
    expect(within(event).getByText("Members only")).toBeInTheDocument();
    expect(within(event).queryByText(/Hall|Tap|Works/)).not.toBeInTheDocument();
  });
});

describe("the Directory page, three ways", () => {
  it("Band, Business and Sponsor members see every venue with its booking contact", () => {
    render(<DirectoryContactsPreview />);

    expect(screen.getByRole("columnheader", { name: "Booking contact" })).toBeInTheDocument();
    for (const contact of CONTACTS) expect(screen.getByText(contact)).toBeInTheDocument();
  });

  it("Individual members see the venues, but the contacts aren't in the page at all", () => {
    const { container } = render(<DirectoryIndividualPreview />);

    expect(screen.getByRole("rowheader", { name: "Old Mill Music Hall" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Booking contact" })).not.toBeInTheDocument();
    for (const contact of CONTACTS) expect(container).not.toHaveTextContent(contact);
    expect(
      screen.getByText(/Booking contacts are for Band, Business and Sponsor members/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Design preview" })).getByRole("link", {
        name: "Individual member",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("visitors see the title and a lock, and none of the directory", () => {
    const { container } = render(<DirectoryVisitorPreview />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(DIRECTORY.title);
    expect(screen.getByRole("heading", { name: "This page is for members" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    for (const row of DIRECTORY.rows) {
      for (const cell of row) expect(container).not.toHaveTextContent(cell);
    }
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fdesign-preview%2Fdirectory",
    );
  });
});
