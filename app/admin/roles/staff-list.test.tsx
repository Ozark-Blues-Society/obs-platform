import { fireEvent, render, screen, within } from "@testing-library/react";
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
});
