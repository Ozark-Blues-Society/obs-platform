import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PillFilters } from "./pill-filters";
import { PillLinks } from "./pill-links";

const LINKS = [
  { label: "All", href: "/blog", current: false },
  { label: "Recap", href: "/blog?category=recap", current: true },
  { label: "Education", href: "/blog?category=education", current: false },
];

describe("PillLinks", () => {
  it("is a labelled list of links, with the shown filter as the current page", () => {
    render(<PillLinks label="Blog categories" links={LINKS} />);

    const nav = screen.getByRole("navigation", { name: "Blog categories" });
    const links = within(within(nav).getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(LINKS.map((link) => link.href));
    expect(within(nav).getByRole("link", { name: "Recap", current: "page" })).toBeInTheDocument();
    expect(links.filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("looks like PillFilters: the same classes for a selected and an unselected pill", () => {
    render(
      <>
        <PillLinks label="Links" links={LINKS} />
        <PillFilters
          label="Buttons"
          options={[
            { value: "all", label: "All" },
            { value: "recap", label: "Recap" },
          ]}
          value="recap"
          onChange={() => {}}
        />
      </>,
    );
    const classes = (element: HTMLElement) =>
      [...element.classList].filter((name) => name !== "inline-block").sort();

    const links = screen.getByRole("navigation", { name: "Links" });
    const buttons = screen.getByRole("group", { name: "Buttons" });
    expect(classes(within(links).getByRole("link", { name: "Recap" }))).toEqual(
      classes(within(buttons).getByRole("button", { name: "Recap" })),
    );
    expect(classes(within(links).getByRole("link", { name: "All" }))).toEqual(
      classes(within(buttons).getByRole("button", { name: "All" })),
    );
  });
});
