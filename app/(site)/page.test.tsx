import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

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
});
