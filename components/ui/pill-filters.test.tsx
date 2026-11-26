import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PillFilters } from "./pill-filters";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "concert", label: "Concert" },
  { value: "jam", label: "Jam" },
] as const;

type Category = (typeof OPTIONS)[number]["value"];

function Filters({ onChange = () => {} }: { onChange?: (value: Category) => void }) {
  const [value, setValue] = useState<Category>("all");
  return (
    <PillFilters
      label="Event category"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

const pressed = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);

describe("PillFilters", () => {
  it("is a labelled group of toggle buttons with the selected one pressed", () => {
    render(<Filters />);

    const group = screen.getByRole("group", { name: "Event category" });
    expect(group).toContainElement(screen.getByRole("button", { name: "Concert" }));
    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concert", pressed: false })).toBeInTheDocument();
    expect(pressed()).toEqual(["All"]);
  });

  it("selects the clicked pill and reports its value", () => {
    const onChange = vi.fn();
    render(<Filters onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Jam" }));

    expect(onChange).toHaveBeenCalledWith("jam");
    expect(pressed()).toEqual(["Jam"]);
  });

  it("uses buttons that don't submit a surrounding form", () => {
    render(<Filters />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
    }
  });
});
