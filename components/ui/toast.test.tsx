import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";

function SaveButton({ message = "Saved" }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(message)}>
      Save
    </button>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the message in a polite live region that was already in the page", () => {
    render(
      <ToastProvider>
        <SaveButton />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Saved");
  });

  it("removes the message after its duration", () => {
    render(
      <ToastProvider duration={3000}>
        <SaveButton />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows one message at a time, and a new one restarts the clock", () => {
    render(
      <ToastProvider duration={3000}>
        <SaveButton message="First" />
      </ToastProvider>,
    );
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(save);

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status").childElementCount).toBe(1);
    expect(screen.getByRole("status")).toHaveTextContent("First");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("fails loudly without a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // React logs the thrown error
    expect(() => render(<SaveButton />)).toThrow("useToast() needs a <ToastProvider>");
  });
});
