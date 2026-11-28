import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SIGNUP_MESSAGES, type SignupState } from "@/lib/newsletter/signup-state";
import { NewsletterSignup } from "./newsletter-signup";

function answering(state: SignupState) {
  return vi.fn(async (): Promise<SignupState> => state);
}

const address = () => screen.getByLabelText("Email address");
const subscribe = () => fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));

describe("NewsletterSignup", () => {
  it("is a labelled box with an address field that browsers can fill in", () => {
    render(<NewsletterSignup action={vi.fn()} />);

    const box = screen.getByRole("region", { name: "Get the blog in your inbox" });
    expect(box).toHaveTextContent(
      "A monthly digest of new posts and upcoming shows. Members get it automatically.",
    );
    expect(address()).toHaveAttribute("type", "email");
    expect(address()).toHaveAttribute("autocomplete", "email");
    expect(address()).toHaveAttribute("placeholder", "you@example.com");
    expect(address()).toBeRequired();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    // The trap field is for bots: out of reach of people and screen readers.
    expect(screen.queryByLabelText("Leave this empty")).not.toBeVisible();
    expect(screen.getAllByRole("textbox")).toEqual([address()]);
  });

  it("sends the address and says what happens next", async () => {
    const action = answering({ status: "done" });
    render(<NewsletterSignup action={action} />);

    fireEvent.change(address(), { target: { value: "ada.quinn@example.com" } });
    subscribe();

    expect(await screen.findByText(SIGNUP_MESSAGES.done)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(SIGNUP_MESSAGES.done);
    const sent = action.mock.calls[0] as unknown as [SignupState, FormData];
    expect(Object.fromEntries(sent[1])).toEqual({ email: "ada.quinn@example.com", website: "" });
    expect(address()).toHaveValue("");
  });

  it("shows a problem with the address on the field, and keeps what was typed", async () => {
    render(
      <NewsletterSignup
        action={answering({
          status: "error",
          field: "email",
          message: SIGNUP_MESSAGES.emailInvalid,
          email: "ada.quinn",
        })}
      />,
    );

    fireEvent.change(address(), { target: { value: "ada.quinn" } });
    subscribe();

    expect(await screen.findByRole("alert")).toHaveTextContent(SIGNUP_MESSAGES.emailInvalid);
    expect(address()).toHaveAttribute("aria-invalid", "true");
    expect(address()).toHaveAccessibleDescription(SIGNUP_MESSAGES.emailInvalid);
    expect(address()).toHaveValue("ada.quinn");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when the signup couldn't be sent, without blaming the address", async () => {
    render(
      <NewsletterSignup
        action={answering({
          status: "error",
          field: null,
          message: SIGNUP_MESSAGES.unavailable,
          email: "ada.quinn@example.com",
        })}
      />,
    );

    fireEvent.change(address(), { target: { value: "ada.quinn@example.com" } });
    subscribe();

    expect(await screen.findByRole("alert")).toHaveTextContent(SIGNUP_MESSAGES.unavailable);
    expect(address()).not.toHaveAttribute("aria-invalid");
    expect(address()).toHaveValue("ada.quinn@example.com");
  });
});
