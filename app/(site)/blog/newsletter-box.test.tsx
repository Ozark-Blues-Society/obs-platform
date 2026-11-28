import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ MAILERLITE_API_KEY: undefined as string | undefined }));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ ...env }) }));
vi.mock("@/lib/newsletter/signup-actions", () => ({ signUpForNewsletter: vi.fn() }));

const { NewsletterBox } = await import("./newsletter-box");

beforeEach(() => {
  env.MAILERLITE_API_KEY = undefined;
});

describe("NewsletterBox", () => {
  it("shows nothing while MailerLite isn't connected", () => {
    const { container } = render(<NewsletterBox />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the signup box once MAILERLITE_API_KEY is set", () => {
    env.MAILERLITE_API_KEY = "a-mailerlite-token";
    render(<NewsletterBox />);
    expect(screen.getByRole("region", { name: "Get the blog in your inbox" })).toBeInTheDocument();
  });
});
