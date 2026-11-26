import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ComponentsPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/dev/components", () => {
  it("answers 404 in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => ComponentsPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("shows every component in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<ComponentsPage />);

    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual([
      "Button",
      "Card",
      "Tag",
      "Pill filters",
      "Table",
      "Form fields",
      "Modal",
      "Toast",
      "Lock overlay",
      "Event card",
      "Post card",
      "Sponsor logo",
    ]);
  });
});
