import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FILE_MESSAGES,
  type MemberFileRow,
  type RemoveFileState,
} from "@/lib/admin/member-files-state";
import { FileList } from "./file-list";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Answers yes to the "Remove …?" question. */
function confirmRemoval() {
  return vi.spyOn(window, "confirm").mockReturnValue(true);
}

const FILE: MemberFileRow = {
  id: "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b",
  title: "Board minutes",
  fileName: "Board minutes.pdf",
  sizeBytes: 16,
  audience: "members",
  levels: [],
  createdAt: "2026-11-20T18:00:00Z",
};

describe("FileList", () => {
  it("names each file's buttons after it, starting with the words they show", () => {
    render(<FileList files={[FILE]} action={vi.fn(async () => ({ status: "idle" as const }))} />);
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(FILE.id);
    // Speech input users say the words they see (WCAG 2.5.3 Label in Name).
    const copy = within(item).getByRole("button", { name: "Copy code for Board minutes" });
    expect(copy).toHaveTextContent(/^Copy code$/);
    const remove = within(item).getByRole("button", { name: "Remove Board minutes" });
    expect(remove).toHaveTextContent(/^Remove$/);
  });

  it("reads out the same problem again when the next removal fails the same way", async () => {
    confirmRemoval();
    const action = vi.fn(async (): Promise<RemoveFileState> => ({
      status: "error",
      message: FILE_MESSAGES.unavailable,
    }));
    render(<FileList files={[FILE]} action={action} />);
    const remove = screen.getByRole("button", { name: "Remove Board minutes" });

    fireEvent.click(remove);
    const first = await screen.findByRole("alert");
    fireEvent.click(remove);

    // A new alert, which screen readers read out. The same one, unchanged, is read out by nobody.
    await waitFor(() => expect(screen.getByRole("alert")).not.toBe(first));
    expect(screen.getByRole("alert")).toHaveTextContent(FILE_MESSAGES.unavailable);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("keeps the button focused while removing, and ignores another press", async () => {
    const confirm = confirmRemoval();
    let answer: (state: RemoveFileState) => void = () => {};
    const action = vi.fn<(state: RemoveFileState, formData: FormData) => Promise<RemoveFileState>>(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    render(<FileList files={[FILE]} action={action} />);
    const remove = screen.getByRole("button", { name: "Remove Board minutes" });

    remove.focus();
    fireEvent.click(remove);
    // Announced as unavailable, but not disabled: browsers take focus away from a disabled button.
    await waitFor(() => expect(remove).toHaveAttribute("aria-disabled", "true"));
    expect(remove).toBeEnabled();
    expect(remove).toHaveFocus();
    // Another press neither asks again nor sends.
    fireEvent.click(remove);

    await act(async () => answer({ status: "removed", message: 'Removed "Board minutes".' }));
    expect(await screen.findByText('Removed "Board minutes".')).toBeVisible();
    expect(confirm).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(remove).toHaveFocus();
  });
});
