import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders one level-1 heading inside the main landmark", () => {
    render(<Home />);

    const main = screen.getByRole("main");
    const headings = screen.getAllByRole("heading", { level: 1 });

    expect(headings).toHaveLength(1);
    expect(main).toContainElement(headings[0]);
  });

  it("names the Society", () => {
    render(<Home />);

    expect(screen.getByText("Ozark Blues Society")).toBeInTheDocument();
  });
});
