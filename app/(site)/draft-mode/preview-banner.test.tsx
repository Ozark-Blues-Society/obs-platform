import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewBanner } from "./preview-banner";

vi.mock("./actions", () => ({ exitPreview: vi.fn() }));

describe("PreviewBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // jsdom has no window.opener; the last test adds one.
    Reflect.deleteProperty(window, "opener");
  });

  it("tells a shared-link visitor they're seeing unpublished changes, with a way out", () => {
    render(<PreviewBanner />);

    const banner = screen.getByRole("complementary", { name: "Preview" });
    expect(banner).toHaveTextContent("unpublished changes");
    expect(screen.getByRole("button", { name: "Exit preview" })).toBeInTheDocument();
  });

  it("stays out of the way inside the Studio's preview frame", () => {
    vi.spyOn(window, "top", "get").mockReturnValue({} as Window);
    render(<PreviewBanner />);

    expect(screen.queryByRole("complementary", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("stays out of the way in a preview window opened from the Studio", () => {
    Object.defineProperty(window, "opener", { value: {}, configurable: true });
    render(<PreviewBanner />);

    expect(screen.queryByRole("complementary", { name: "Preview" })).not.toBeInTheDocument();
  });
});
