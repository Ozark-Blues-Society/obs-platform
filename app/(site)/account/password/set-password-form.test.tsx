import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PASSWORD_MESSAGES, type SetPasswordState } from "@/lib/auth/password-state";
import { SetPasswordForm } from "./set-password-form";

const EMAIL = "hazel.monroe@example.com";

function answering(state: SetPasswordState) {
  return vi.fn(async (): Promise<SetPasswordState> => state);
}

function submit(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Type the new password again"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
}

describe("SetPasswordForm", () => {
  it("labels both fields for password managers and gives the rules up front", () => {
    const { container } = render(<SetPasswordForm action={vi.fn()} email={EMAIL} />);

    const password = screen.getByLabelText("New password");
    const confirm = screen.getByLabelText("Type the new password again");
    for (const field of [password, confirm]) {
      expect(field).toHaveAttribute("type", "password");
      expect(field).toHaveAttribute("autocomplete", "new-password");
      expect(field).not.toHaveAttribute("aria-invalid");
    }
    expect(password).toHaveAccessibleDescription(PASSWORD_MESSAGES.hint);
    // The account the password is for, hidden from view.
    const username = container.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue(EMAIL);
    expect(username).not.toBeVisible();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows a problem with the new password on that field, after the rules", async () => {
    const action = answering({
      status: "error",
      field: "password",
      message: PASSWORD_MESSAGES.tooShort,
    });
    render(<SetPasswordForm action={action} email={EMAIL} />);

    submit("short", "short");

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_MESSAGES.tooShort);
    const password = screen.getByLabelText("New password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription(
      `${PASSWORD_MESSAGES.hint} ${PASSWORD_MESSAGES.tooShort}`,
    );
    expect(screen.getByLabelText("Type the new password again")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(action).toHaveBeenCalledOnce();
  });

  it("shows passwords that don't match on the second field", async () => {
    render(
      <SetPasswordForm
        action={answering({
          status: "error",
          field: "confirm",
          message: PASSWORD_MESSAGES.mismatch,
        })}
        email={EMAIL}
      />,
    );

    submit("delta blues forever", "delta blues for ever");

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_MESSAGES.mismatch);
    const confirm = screen.getByLabelText("Type the new password again");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(confirm).toHaveAccessibleDescription(PASSWORD_MESSAGES.mismatch);
    expect(screen.getByLabelText("New password")).not.toHaveAttribute("aria-invalid");
  });

  it("confirms the new password in a status message", async () => {
    render(<SetPasswordForm action={answering({ status: "saved" })} email={EMAIL} />);

    submit("delta blues forever", "delta blues forever");

    expect(await screen.findByText("Your new password is saved.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("sign in with your email address");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads out the same problem again when the next try fails the same way", async () => {
    const action = answering({
      status: "error",
      field: "confirm",
      message: PASSWORD_MESSAGES.mismatch,
    });
    render(<SetPasswordForm action={action} email={EMAIL} />);

    submit("delta blues forever", "delta blues for ever");
    const first = await screen.findByRole("alert");
    submit("delta blues forever", "delta blues for ever");

    // A new alert, which screen readers read out. The same one, unchanged, is read out by nobody.
    await waitFor(() => expect(screen.getByRole("alert")).not.toBe(first));
    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_MESSAGES.mismatch);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("keeps the button focused while saving, and ignores another press", async () => {
    let answer: (state: SetPasswordState) => void = () => {};
    const action = vi.fn<
      (state: SetPasswordState, formData: FormData) => Promise<SetPasswordState>
    >(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    render(<SetPasswordForm action={action} email={EMAIL} />);
    const button = screen.getByRole("button", { name: "Save password" });

    button.focus();
    submit("delta blues forever", "delta blues forever");
    expect(await screen.findByRole("button", { name: "Saving…" })).toBe(button);
    // Announced as unavailable, but not disabled: browsers take focus away from a disabled button.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
    fireEvent.click(button);

    await act(async () => answer({ status: "saved" }));
    expect(await screen.findByText("Your new password is saved.")).toBeInTheDocument();
    expect(action).toHaveBeenCalledOnce();
    expect(button).toHaveFocus();
  });
});
