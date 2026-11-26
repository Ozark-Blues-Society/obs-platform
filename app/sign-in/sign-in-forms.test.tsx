import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES, type EmailLinkState, type PasswordState } from "@/lib/auth/sign-in-state";
import { EmailLinkForm, PasswordForm } from "./sign-in-forms";

describe("EmailLinkForm", () => {
  it("labels the email field and says what the button does", () => {
    render(<EmailLinkForm action={vi.fn()} />);

    const email = screen.getByLabelText("Email address");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toBeEnabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("confirms the request in a status message", async () => {
    const action = vi.fn(
      async (_state: EmailLinkState, formData: FormData): Promise<EmailLinkState> => ({
        status: "sent",
        email: String(formData.get("email")),
      }),
    );
    render(<EmailLinkForm action={action} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "avery@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    expect(await screen.findByText("Check your email.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("avery@example.com");
    expect(action).toHaveBeenCalledOnce();
  });

  it("shows an error next to the field and keeps what was typed", async () => {
    const action = vi.fn(
      async (_state: EmailLinkState, formData: FormData): Promise<EmailLinkState> => ({
        status: "error",
        email: String(formData.get("email")),
        message: MESSAGES.emailInvalid,
      }),
    );
    render(<EmailLinkForm action={action} />);

    const email = screen.getByLabelText("Email address");
    fireEvent.change(email, { target: { value: "avery@example" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(MESSAGES.emailInvalid);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(MESSAGES.emailInvalid);
    expect(email).toHaveValue("avery@example");
  });
});

describe("PasswordForm", () => {
  it("labels both fields for password managers and carries the return path", () => {
    const { container } = render(<PasswordForm action={vi.fn()} next="/events" />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(container.querySelector('input[name="next"]')).toHaveValue("/events");
  });

  it("shows a wrong-password error on the password field and keeps the email", async () => {
    const action = vi.fn(
      async (_state: PasswordState, formData: FormData): Promise<PasswordState> => ({
        status: "error",
        email: String(formData.get("email")),
        message: MESSAGES.wrongPassword,
      }),
    );
    render(<PasswordForm action={action} next="/account" />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "avery@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.wrongPassword);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(MESSAGES.wrongPassword);
    expect(screen.getByLabelText("Email address")).toHaveValue("avery@example.com");
  });
});
