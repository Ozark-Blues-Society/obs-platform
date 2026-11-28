import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_CHOICES_MESSAGES } from "@/lib/account/email-choices-state";

const mocks = vi.hoisted(() => ({
  env: { MAILERLITE_API_KEY: undefined as string | undefined },
  read: vi.fn(),
  address: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ ...mocks.env }) }));
vi.mock("@/lib/auth/user", () => ({
  requireUser: async () => ({ id: "member-id", email: "jordan.ellis@example.com" }),
}));
vi.mock("@/lib/account/email-choices", () => ({ memberAddress: mocks.address }));
vi.mock("@/lib/account/email-choices-actions", () => ({ saveEmailChoicesAction: vi.fn() }));
vi.mock("@/lib/mailerlite/topics", () => ({ readEmailChoices: mocks.read }));

const { EmailChoicesCard } = await import("./email-choices-card");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.MAILERLITE_API_KEY = "a-mailerlite-token";
  mocks.address.mockResolvedValue({ email: "jordan.ellis@example.com", subscriberId: null });
});

describe("EmailChoicesCard", () => {
  it("shows nothing, and asks MailerLite nothing, while MailerLite isn't connected", async () => {
    mocks.env.MAILERLITE_API_KEY = undefined;
    const { container } = render(await EmailChoicesCard());
    expect(container).toBeEmptyDOMElement();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("shows the switches as MailerLite has them", async () => {
    mocks.read.mockResolvedValue({ choices: { newsletter: false, events: true }, paused: false });
    render(await EmailChoicesCard());

    const card = screen.getByRole("region", { name: "Newsletter and announcements" });
    expect(card).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Monthly newsletter" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Event announcements" })).toBeChecked();
  });

  it("says the choices can't be shown when MailerLite doesn't answer, and logs no address", async () => {
    mocks.read.mockRejectedValue(new Error("MailerLite refused to fetch a subscriber (HTTP 503)"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(await EmailChoicesCard());

    expect(screen.getByRole("alert")).toHaveTextContent(EMAIL_CHOICES_MESSAGES.cantShow);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(JSON.stringify(error.mock.calls)).not.toContain("jordan");
    error.mockRestore();
  });
});
