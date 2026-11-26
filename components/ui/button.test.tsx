import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

/** Renders `button` in a form, and returns the form's submit handler. */
function inForm(button: ReactNode) {
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  render(<form onSubmit={onSubmit}>{button}</form>);
  return onSubmit;
}

describe("Button", () => {
  it("never submits a form unless it's a submit button", () => {
    const onSubmit = inForm(<Button>Cancel</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("passes presses on and submits its form", () => {
    const onClick = vi.fn();
    const onSubmit = inForm(
      <Button type="submit" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).not.toHaveAttribute("aria-disabled");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("while its form is sending, ignores presses but stays enabled, so it keeps focus", () => {
    const onClick = vi.fn();
    const onSubmit = inForm(
      <Button type="submit" pending onClick={onClick}>
        Saving…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    button.focus();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    // Announced as unavailable. Not disabled: browsers take focus away from a disabled button.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
  });
});
