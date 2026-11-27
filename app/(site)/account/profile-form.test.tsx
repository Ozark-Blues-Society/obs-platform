import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PROFILE_MESSAGES,
  type ProfileState,
  type ProfileValues,
} from "@/lib/account/profile-state";
import { ProfileForm } from "./profile-form";

const SAVED: ProfileValues = { firstName: "Curtis", lastName: "Bell", phone: "(479) 555-0136" };

function answering(state: ProfileState) {
  return vi.fn(async (): Promise<ProfileState> => state);
}

const field = (label: string) => screen.getByLabelText(label);

function fill(values: Partial<ProfileValues>) {
  const labels: Record<keyof ProfileValues, string> = {
    firstName: "First name",
    lastName: "Last name (optional)",
    phone: "Phone (optional)",
  };
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(field(labels[name as keyof ProfileValues]), { target: { value } });
  }
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save details" }));

describe("ProfileForm", () => {
  it("shows the saved details in labelled fields that browsers can fill in", () => {
    render(<ProfileForm action={vi.fn()} profile={SAVED} />);

    expect(field("First name")).toHaveValue("Curtis");
    expect(field("First name")).toHaveAttribute("autocomplete", "given-name");
    expect(field("First name")).toBeRequired();
    expect(field("Last name (optional)")).toHaveValue("Bell");
    expect(field("Last name (optional)")).toHaveAttribute("autocomplete", "family-name");
    expect(field("Last name (optional)")).not.toBeRequired();
    const phone = field("Phone (optional)");
    expect(phone).toHaveValue("(479) 555-0136");
    expect(phone).toHaveAttribute("type", "tel");
    expect(phone).toHaveAttribute("autocomplete", "tel");
    expect(phone).toHaveAccessibleDescription(PROFILE_MESSAGES.phoneHint);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("sends what was typed, and says the details are saved", async () => {
    const action = answering({
      status: "saved",
      values: { firstName: "Curt", lastName: "Bell", phone: "" },
    });
    render(<ProfileForm action={action} profile={SAVED} />);

    fill({ firstName: "Curt", phone: "" });
    save();

    expect(await screen.findByText(PROFILE_MESSAGES.saved)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(PROFILE_MESSAGES.saved);
    const sent = action.mock.calls[0] as unknown as [ProfileState, FormData];
    expect(Object.fromEntries(sent[1])).toEqual({ firstName: "Curt", lastName: "Bell", phone: "" });
    expect(field("First name")).toHaveValue("Curt");
    expect(field("Phone (optional)")).toHaveValue("");
  });

  it("shows a problem on its field as an alert, and keeps what was typed", async () => {
    const typed = { firstName: "Curtis", lastName: "Bell", phone: "call me" };
    render(
      <ProfileForm
        action={answering({
          status: "error",
          field: "phone",
          message: PROFILE_MESSAGES.phoneInvalid,
          values: typed,
        })}
        profile={SAVED}
      />,
    );

    fill({ phone: "call me" });
    save();

    expect(await screen.findByRole("alert")).toHaveTextContent(PROFILE_MESSAGES.phoneInvalid);
    const phone = field("Phone (optional)");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAccessibleDescription(
      `${PROFILE_MESSAGES.phoneHint} ${PROFILE_MESSAGES.phoneInvalid}`,
    );
    expect(phone).toHaveValue("call me");
    expect(field("First name")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when the details couldn't be saved at all", async () => {
    render(
      <ProfileForm
        action={answering({
          status: "error",
          field: null,
          message: PROFILE_MESSAGES.unavailable,
          values: SAVED,
        })}
        profile={SAVED}
      />,
    );

    save();

    expect(await screen.findByRole("alert")).toHaveTextContent(PROFILE_MESSAGES.unavailable);
    for (const label of ["First name", "Last name (optional)", "Phone (optional)"]) {
      expect(field(label)).not.toHaveAttribute("aria-invalid");
    }
  });

  it("makes a repeated problem a new alert, so it's read out again", async () => {
    render(
      <ProfileForm
        action={answering({
          status: "error",
          field: "firstName",
          message: PROFILE_MESSAGES.firstNameMissing,
          values: { ...SAVED, firstName: "" },
        })}
        profile={SAVED}
      />,
    );

    fill({ firstName: "" });
    save();
    const first = await screen.findByRole("alert");
    save();
    await waitFor(() => expect(screen.getByRole("alert")).not.toBe(first));
    expect(screen.getByRole("alert")).toHaveTextContent(PROFILE_MESSAGES.firstNameMissing);
  });
});
