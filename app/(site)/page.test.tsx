import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

// The sponsor band reads Sanity on the server (components/home/home-sponsors.test.tsx tests it).
vi.mock("@/components/home/home-sponsors", () => ({
  HomeSponsors: () => <section aria-label="Our sponsors" />,
}));

describe("Home page", () => {
  // The site layout supplies the <main> landmark (app/(site)/layout.tsx), so the page has none.
  it("renders one level-1 heading and no main landmark of its own", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("names the Society", () => {
    render(<Home />);

    expect(screen.getByText("Ozark Blues Society")).toBeInTheDocument();
  });

  it("shows the sponsor band", () => {
    render(<Home />);

    expect(screen.getByRole("region", { name: "Our sponsors" })).toBeInTheDocument();
  });
});
