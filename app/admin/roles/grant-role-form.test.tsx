import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROLE_MESSAGES, type GrantRoleState } from "@/lib/admin/roles-state";
import { GrantRoleForm } from "./grant-role-form";

function answering(state: GrantRoleState) {
  return vi.fn(async (): Promise<GrantRoleState> => state);
}

function submit(email: string, role: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Role"), { target: { value: role } });
  fireEvent.click(screen.getByRole("button", { name: "Give role" }));
}

describe("GrantRoleForm", () => {
  it("labels both fields and offers the four roles", () => {
    render(<GrantRoleForm action={vi.fn()} />);

    const email = screen.getByLabelText("Email address");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAccessibleDescription(ROLE_MESSAGES.emailHint);
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(
      screen
        .getAllByRole("option")
        .map((option) => [option.textContent, option.getAttribute("value")]),
    ).toEqual([
      ["Choose a role", ""],
      ["Administrator", "admin"],
      ["Membership Manager", "membership_manager"],
      ["Moderator", "moderator"],
      ["Editor", "editor"],
    ]);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("sends the address and role, and shows a problem with the address on that field", async () => {
    const action = answering({
      status: "error",
      field: "email",
      message: ROLE_MESSAGES.noAccount,
      email: "kelly@example.com",
      role: "moderator",
    });
    render(<GrantRoleForm action={action} />);

    submit("kelly@example.com", "moderator");

    expect(await screen.findByRole("alert")).toHaveTextContent(ROLE_MESSAGES.noAccount);
    const sent = action.mock.calls[0] as unknown as [GrantRoleState, FormData];
    expect(Object.fromEntries(sent[1])).toEqual({ email: "kelly@example.com", role: "moderator" });
    const email = screen.getByLabelText("Email address");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      `${ROLE_MESSAGES.emailHint} ${ROLE_MESSAGES.noAccount}`,
    );
    // What was typed stays, so it can be corrected.
    expect(email).toHaveValue("kelly@example.com");
    expect(screen.getByLabelText("Role")).toHaveValue("moderator");
  });

  it("shows a missing role on the role field", async () => {
    render(
      <GrantRoleForm
        action={answering({
          status: "error",
          field: "role",
          message: ROLE_MESSAGES.roleMissing,
          email: "dale.ramsey@example.com",
          role: "",
        })}
      />,
    );

    submit("dale.ramsey@example.com", "");

    expect(await screen.findByRole("alert")).toHaveTextContent(ROLE_MESSAGES.roleMissing);
    expect(screen.getByLabelText("Role")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Role")).toHaveAccessibleDescription(ROLE_MESSAGES.roleMissing);
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid");
  });

  it("shows a problem that isn't about one field without marking either", async () => {
    render(
      <GrantRoleForm
        action={answering({
          status: "error",
          field: null,
          message: "Dale Ramsey already has the Moderator role.",
          email: "dale.ramsey@example.com",
          role: "moderator",
        })}
      />,
    );

    submit("dale.ramsey@example.com", "moderator");

    expect(await screen.findByRole("alert")).toHaveTextContent("already has the Moderator role");
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Role")).not.toHaveAttribute("aria-invalid");
  });

  it("announces the new role and clears the form", async () => {
    render(
      <GrantRoleForm
        action={answering({ status: "granted", message: "Dale Ramsey now has the Editor role." })}
      />,
    );

    submit("dale.ramsey@example.com", "editor");

    expect(await screen.findByText("Dale Ramsey now has the Editor role.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dale Ramsey now has the Editor role.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("");
  });
});
