import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FILE_MESSAGES } from "@/lib/admin/member-files-state";
import { UploadFileForm } from "./upload-file-form";

const ID = "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b";
const PATH = `${ID}/Board-minutes.pdf`;

function setup(overrides: Partial<Parameters<typeof UploadFileForm>[0]> = {}) {
  const props = {
    prepare: vi.fn(async () => ({
      status: "ready" as const,
      path: PATH,
      uploadUrl: "http://storage/upload?token=t",
    })),
    upload: vi.fn(async () => true),
    save: vi.fn(async () => ({
      status: "saved" as const,
      id: ID,
      message: 'Added "Board minutes". Copy its code into the Studio.',
    })),
    ...overrides,
  };
  render(<UploadFileForm {...props} />);
  return props;
}

function chooseFile(file: File) {
  const input = screen.getByLabelText("File") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

const pdf = () => new File(["%PDF-1.7 minutes"], "Board minutes.pdf", { type: "application/pdf" });

/** Presses Upload file, which takes focus first, as a click or a key press on it does. */
async function submit() {
  const button = screen.getByRole("button", { name: "Upload file" });
  button.focus();
  await act(async () => {
    fireEvent.click(button);
  });
}

/**
 * Submits, then checks that focus went to `field` and that the field's description already held
 * `message` when it took focus: that's when a screen reader reads it out (WCAG 4.1.3).
 */
async function submitAndExpectFocusOn(field: HTMLElement, message: string) {
  let describedAs = "";
  const onFocus = () => {
    describedAs = (field.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
  };
  field.addEventListener("focus", onFocus);
  await submit();
  field.removeEventListener("focus", onFocus);
  expect(field).toHaveFocus();
  expect(describedAs).toContain(message);
  expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
}

describe("UploadFileForm", () => {
  it("uploads the file to the one-time link, then saves it, and shows the new code", async () => {
    const props = setup();
    chooseFile(pdf());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Board minutes" } });
    fireEvent.click(screen.getByLabelText("Only some membership levels"));
    fireEvent.click(screen.getByLabelText("Band"));
    fireEvent.click(screen.getByLabelText("Sponsor"));
    await submit();

    await waitFor(() => expect(props.save).toHaveBeenCalled());
    expect(props.prepare).toHaveBeenCalledWith({ name: "Board minutes.pdf", size: 16 });
    expect(props.upload).toHaveBeenCalledWith("http://storage/upload?token=t", expect.any(File));
    expect(props.save).toHaveBeenCalledWith({
      path: PATH,
      fileName: "Board minutes.pdf",
      title: "Board minutes",
      audience: "levels",
      levels: ["band", "sponsor"],
    });
    const message = await screen.findByText(/Added "Board minutes"/);
    // In the form's live region, so screen readers announce it, with the code to copy.
    const status = message.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status).toHaveTextContent(ID);
    // Named starting with the words it shows, so speech input can use them (WCAG 2.5.3).
    const copy = screen.getByRole("button", { name: "Copy code for the new file" });
    expect(copy).toBeVisible();
    expect(copy).toHaveTextContent(/^Copy code$/);
  });

  it("checks the form before uploading anything, and takes focus to the field to fix", async () => {
    const props = setup();
    await submitAndExpectFocusOn(screen.getByLabelText("File"), FILE_MESSAGES.fileMissing);

    chooseFile(pdf());
    const name = screen.getByLabelText("Name");
    await submitAndExpectFocusOn(name, FILE_MESSAGES.titleMissing);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(FILE_MESSAGES.titleMissing)).toBeVisible();

    fireEvent.change(name, { target: { value: "Board minutes" } });
    fireEvent.click(screen.getByLabelText("Only some membership levels"));
    const levels = screen.getByRole("group", { name: "Membership levels" });
    // The group's own description isn't read reliably when focus enters it, so the first box
    // carries the message too.
    const firstLevel = within(levels).getAllByRole("checkbox")[0];
    await submitAndExpectFocusOn(firstLevel, FILE_MESSAGES.levelsMissing);
    expect(levels).toHaveAccessibleDescription(FILE_MESSAGES.levelsMissing);
    expect(screen.getByText(FILE_MESSAGES.levelsMissing)).toBeVisible();

    expect(props.prepare).not.toHaveBeenCalled();
  });

  it("takes focus back to the field each time the same check fails", async () => {
    setup();
    const file = screen.getByLabelText("File");
    await submitAndExpectFocusOn(file, FILE_MESSAGES.fileMissing);
    await submitAndExpectFocusOn(file, FILE_MESSAGES.fileMissing);
  });

  it("refuses a file over 50 MB in the browser", async () => {
    const props = setup();
    const big = pdf();
    Object.defineProperty(big, "size", { value: 51 * 1024 * 1024 });
    chooseFile(big);
    await submitAndExpectFocusOn(screen.getByLabelText("File"), FILE_MESSAGES.fileTooBig);
    expect(screen.getByText(FILE_MESSAGES.fileTooBig)).toBeVisible();
    expect(props.prepare).not.toHaveBeenCalled();
  });

  it("says so when the upload doesn't finish, and saves nothing", async () => {
    const props = setup({ upload: vi.fn(async () => false) });
    chooseFile(pdf());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Board minutes" } });
    await submit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(FILE_MESSAGES.uploadFailed),
    );
    expect(props.save).not.toHaveBeenCalled();
  });

  it("shows the server's message when it refuses", async () => {
    setup({
      prepare: vi.fn(async () => ({ status: "error" as const, message: FILE_MESSAGES.notEditor })),
    });
    chooseFile(pdf());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Board minutes" } });
    await submit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(FILE_MESSAGES.notEditor),
    );
  });

  it("asks for levels only when some levels can download it", () => {
    setup();
    expect(screen.queryByRole("group", { name: "Membership levels" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Only some membership levels"));
    expect(screen.getByRole("group", { name: "Membership levels" })).toBeVisible();
  });
});
