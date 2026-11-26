import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MODERATION_MESSAGES,
  type ModerationResult,
  type PendingListing,
} from "@/lib/listings/moderation-state";
import { ModerationQueue } from "./moderation-queue";

const HARMONICA: PendingListing = {
  id: "00000000-0000-4000-8200-000000000005",
  revision: 1,
  category: "gear",
  title: "Harmonica set (7 keys) with case",
  body: "Lightly used.\nKeys of C, G, A, D, E, F and B♭.",
  price: 120,
  contactPref: "email",
  submittedAt: "2026-11-24T18:00:00Z",
  poster: "Pat W.",
  photo: { status: "shown", url: "http://127.0.0.1:54321/storage/v1/object/sign/x?token=t" },
};

const KEYS: PendingListing = {
  id: "00000000-0000-4000-8200-000000000004",
  revision: 3,
  category: "musicians_wanted",
  title: "Keys player wanted for a gospel blues group",
  body: "Hammond experience a plus.",
  price: null,
  contactPref: "phone",
  submittedAt: "2026-11-25T18:00:00Z",
  poster: null,
  photo: { status: "missing" },
};

const never = () => new Promise<ModerationResult>(() => {});

function renderQueue({
  listings = [HARMONICA, KEYS],
  approve = vi.fn(never),
  reject = vi.fn(never),
}: {
  listings?: PendingListing[];
  approve?: (target: { id: string; revision: number }) => Promise<ModerationResult>;
  reject?: (target: { id: string; revision: number; reason: string }) => Promise<ModerationResult>;
} = {}) {
  render(<ModerationQueue listings={listings} approve={approve} reject={reject} />);
  return { approve, reject };
}

const card = (title: string) => {
  const item = screen
    .getByRole("heading", { name: (name) => name.startsWith(title) })
    .closest("li");
  if (!item) throw new Error(`No card for ${title}`);
  return within(item);
};

describe("ModerationQueue", () => {
  it("shows each waiting listing, in the order given (oldest first), with its details", () => {
    renderQueue();

    expect(screen.getByRole("heading", { name: "Waiting for review (2)" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Harmonica set (7 keys) with case — $120",
      "Keys player wanted for a gospel blues group",
    ]);
    const harmonica = card(HARMONICA.title);
    expect(harmonica.getByText("Gear")).toBeVisible();
    expect(harmonica.getByText(/by Pat W\. · sent/)).toHaveTextContent("sent Nov 24, 2026");
    expect(harmonica.getByText(/Lightly used\./)).toHaveTextContent(
      "Lightly used. Keys of C, G, A, D, E, F and B♭.",
    );
    expect(harmonica.getByText(/^Contact:/)).toHaveTextContent(
      "Contact: by email, through the website (their address stays private)",
    );
    expect(
      harmonica.getByRole("img", { name: `The photo sent with “${HARMONICA.title}”` }),
    ).toHaveAttribute("src", HARMONICA.photo?.status === "shown" ? HARMONICA.photo.url : "");

    const keys = card(KEYS.title);
    expect(keys.getByText(/by a member · sent/)).toBeVisible();
    expect(keys.getByText(/^Contact:/)).toHaveTextContent(
      "by phone, at the number on their profile",
    );
    expect(keys.queryByRole("img")).toBeNull();
    expect(keys.getByText(/Its photo can.t be shown here/)).toBeVisible();
    // Each button says which listing it's for.
    expect(keys.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription(
      "Keys player wanted for a gospel blues group",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says when nothing is waiting", () => {
    renderQueue({ listings: [] });

    expect(screen.getByRole("heading", { name: "Waiting for review (0)" })).toBeVisible();
    expect(screen.getByText(/Nothing is waiting for review/)).toBeVisible();
  });

  it("approves the revision it shows, announces the outcome and moves focus to the list", async () => {
    const approve = vi.fn(async (): Promise<ModerationResult> => ({
      status: "approved",
      message: "It's live.",
    }));
    renderQueue({ approve });

    fireEvent.click(card(KEYS.title).getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("It's live.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("It's live.");
    expect(approve).toHaveBeenCalledExactlyOnceWith({ id: KEYS.id, revision: 3 });
    expect(screen.getByRole("heading", { name: "Waiting for review (2)" })).toHaveFocus();
  });

  it("explains a decision that didn't go through, and keeps focus where it was", async () => {
    renderQueue({
      approve: async () => ({ status: "error", message: MODERATION_MESSAGES.notModerator }),
    });
    const approveButton = card(HARMONICA.title).getByRole("button", { name: "Approve" });
    approveButton.focus();

    fireEvent.click(approveButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(MODERATION_MESSAGES.notModerator);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(approveButton).toHaveFocus();
  });

  it("says so when the request fails on the way", async () => {
    renderQueue({
      approve: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    fireEvent.click(card(HARMONICA.title).getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MODERATION_MESSAGES.unavailable);
  });

  it("ignores presses and hides the last outcome while a decision is on its way", async () => {
    let answer: (result: ModerationResult) => void = () => {};
    const approve = vi
      .fn<() => Promise<ModerationResult>>()
      .mockResolvedValueOnce({ status: "approved", message: "First one's live." })
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    renderQueue({ approve });
    fireEvent.click(card(HARMONICA.title).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("First one's live.")).toBeVisible();

    const keysApprove = card(KEYS.title).getByRole("button", { name: "Approve" });
    fireEvent.click(keysApprove);

    await waitFor(() => expect(keysApprove).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(keysApprove);
    answer({ status: "approved", message: "Second one's live." });
    expect(await screen.findByText("Second one's live.")).toBeVisible();
    expect(approve).toHaveBeenCalledTimes(2);
    expect(keysApprove).not.toHaveAttribute("aria-disabled");
  });

  it("asks for a reason before rejecting, then sends it trimmed", async () => {
    const reject = vi.fn(async (): Promise<ModerationResult> => ({
      status: "rejected",
      message: "Rejected.",
    }));
    renderQueue({ reject });
    const keys = card(KEYS.title);
    const toggle = keys.getByRole("button", { name: "Reject" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(keys.queryByRole("textbox")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const reason = keys.getByRole("textbox", { name: "Reason for the poster" });
    expect(reason).toHaveFocus();
    expect(reason).toHaveAccessibleDescription(MODERATION_MESSAGES.reasonHint);

    const send = keys.getByRole("button", { name: "Reject and email the poster" });
    send.focus();
    fireEvent.click(send);
    expect(reason).toHaveAccessibleDescription(
      `${MODERATION_MESSAGES.reasonHint} ${MODERATION_MESSAGES.reasonMissing}`,
    );
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveFocus();
    expect(reject).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "x".repeat(501) } });
    fireEvent.click(send);
    expect(reason).toHaveAccessibleDescription(
      `${MODERATION_MESSAGES.reasonHint} ${MODERATION_MESSAGES.reasonTooLong}`,
    );
    expect(reject).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "  Please add a price.\n  " } });
    fireEvent.click(send);

    expect(await screen.findByText("Rejected.")).toBeVisible();
    expect(reject).toHaveBeenCalledExactlyOnceWith({
      id: KEYS.id,
      revision: 3,
      reason: "Please add a price.",
    });
    expect(reason).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("heading", { name: "Waiting for review (2)" })).toHaveFocus();
  });

  it("closes the reject form on Cancel, back to the Reject button", () => {
    renderQueue();
    const harmonica = card(HARMONICA.title);
    const toggle = harmonica.getByRole("button", { name: "Reject" });
    fireEvent.click(toggle);

    fireEvent.click(harmonica.getByRole("button", { name: "Cancel" }));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    expect(harmonica.queryByRole("textbox")).toBeNull();
  });
});
