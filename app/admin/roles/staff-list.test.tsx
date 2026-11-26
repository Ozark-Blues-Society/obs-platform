import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROLE_MESSAGES, type RevokeRoleState, type StaffMember } from "@/lib/admin/roles-state";
import { StaffList } from "./staff-list";

const AVERY = "00000000-0000-4000-8100-000000000001";
const DALE = "00000000-0000-4000-8100-000000000017";

const STAFF: StaffMember[] = [
  { id: AVERY, name: "Avery Collins", email: "avery.collins@example.com", roles: ["admin"] },
  {
    id: DALE,
    name: "Dale Ramsey",
    email: "dale.ramsey@example.com",
    roles: ["moderator", "editor"],
  },
];

function answering(state: RevokeRoleState) {
  return vi.fn(async (): Promise<RevokeRoleState> => state);
}

describe("StaffList", () => {
  it("lists each person's roles with a Remove button named for that role and person", () => {
    render(<StaffList staff={STAFF} currentUserId={AVERY} action={vi.fn()} />);

    const dale = screen.getByRole("list", { name: "Roles of Dale Ramsey" });
    expect(
      within(dale)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["ModeratorRemove", "EditorRemove"]);
    expect(
      screen.getByRole("button", { name: "Remove the Editor role from Dale Ramsey" }),
    ).toHaveTextContent("Remove");
    // The administrator looking at the page sees which entry is theirs.
    expect(screen.getByText("(you)").closest("li")).toHaveTextContent("Avery Collins (you)");
    expect(screen.getByRole("button", { name: "Remove your Administrator role" })).toBeVisible();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("sends the role that was chosen and announces that it's gone", async () => {
    const action = answering({
      status: "revoked",
      message: "Dale Ramsey no longer has the Editor role.",
    });
    render(<StaffList staff={STAFF} currentUserId={AVERY} action={action} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove the Editor role from Dale Ramsey" }),
    );

    expect(await screen.findByText("Dale Ramsey no longer has the Editor role.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("no longer has the Editor role");
    const sent = action.mock.calls[0] as unknown as [RevokeRoleState, FormData];
    expect(sent[1].get("remove")).toBe(`${DALE}:editor`);
  });

  it("explains a refusal", async () => {
    render(
      <StaffList
        staff={STAFF}
        currentUserId={AVERY}
        action={answering({ status: "error", message: ROLE_MESSAGES.lastAdmin })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove your Administrator role" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(ROLE_MESSAGES.lastAdmin);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("reads out the same refusal again when the next press is refused the same way", async () => {
    const action = answering({ status: "error", message: ROLE_MESSAGES.lastAdmin });
    render(<StaffList staff={STAFF} currentUserId={AVERY} action={action} />);
    const remove = screen.getByRole("button", { name: "Remove your Administrator role" });

    fireEvent.click(remove);
    const first = await screen.findByRole("alert");
    fireEvent.click(remove);

    // A new alert, which screen readers read out. The same one, unchanged, is read out by nobody.
    await waitFor(() => expect(screen.getByRole("alert")).not.toBe(first));
    expect(screen.getByRole("alert")).toHaveTextContent(ROLE_MESSAGES.lastAdmin);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("keeps the pressed button focused while removing, and ignores more presses", async () => {
    let answer: (state: RevokeRoleState) => void = () => {};
    const action = vi.fn<(state: RevokeRoleState, formData: FormData) => Promise<RevokeRoleState>>(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    render(<StaffList staff={STAFF} currentUserId={AVERY} action={action} />);
    const editor = screen.getByRole("button", { name: "Remove the Editor role from Dale Ramsey" });
    const moderator = screen.getByRole("button", {
      name: "Remove the Moderator role from Dale Ramsey",
    });

    editor.focus();
    fireEvent.click(editor);
    // Announced as unavailable, but not disabled: browsers take focus away from a disabled button.
    await waitFor(() => expect(editor).toHaveAttribute("aria-disabled", "true"));
    expect(moderator).toHaveAttribute("aria-disabled", "true");
    expect(editor).toBeEnabled();
    expect(editor).toHaveFocus();
    fireEvent.click(editor);
    fireEvent.click(moderator);

    await act(async () =>
      answer({ status: "revoked", message: "Dale Ramsey no longer has the Editor role." }),
    );
    expect(await screen.findByText("Dale Ramsey no longer has the Editor role.")).toBeVisible();
    expect(action).toHaveBeenCalledOnce();
    expect(editor).not.toHaveAttribute("aria-disabled");
    expect(editor).toHaveFocus();
  });
});
