import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinishSignInForm } from "./finish-sign-in-form";

const TOKEN_HASH = "pkce_aaae5edb8e194c16ef3d8e7db84281734180e6bae15c4d401faf5847";

describe("FinishSignInForm", () => {
  it("carries the link's token hash and return path, and says what the button does", () => {
    const { container } = render(
      <FinishSignInForm action={vi.fn()} tokenHash={TOKEN_HASH} next="/events" />,
    );

    expect(container.querySelector('input[type="hidden"][name="token_hash"]')).toHaveValue(
      TOKEN_HASH,
    );
    expect(container.querySelector('input[type="hidden"][name="next"]')).toHaveValue("/events");
    expect(screen.getByRole("button", { name: "Finish signing in" })).toBeEnabled();
  });

  it("sends the token hash once, even when the button is pressed twice", async () => {
    let finish = () => {};
    const action = vi.fn<(formData: FormData) => Promise<void>>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<FinishSignInForm action={action} tokenHash={TOKEN_HASH} next="/account" />);

    fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));
    const pending = await screen.findByRole("button", { name: "Signing in…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);

    expect(action).toHaveBeenCalledOnce();
    const formData = action.mock.calls[0][0];
    expect(formData.get("token_hash")).toBe(TOKEN_HASH);
    expect(formData.get("next")).toBe("/account");

    await act(async () => finish());
  });
});
