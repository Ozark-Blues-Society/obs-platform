import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
  });
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
    expect(screen.getByRole("button", { name: "Copy the new file's code" })).toBeVisible();
  });

  it("checks the form before uploading anything", async () => {
    const props = setup();
    await submit();
    expect(screen.getByLabelText("File")).toHaveAccessibleDescription(
      expect.stringContaining(FILE_MESSAGES.fileMissing),
    );

    chooseFile(pdf());
    await submit();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(FILE_MESSAGES.titleMissing)).toBeVisible();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Board minutes" } });
    fireEvent.click(screen.getByLabelText("Only some membership levels"));
    await submit();
    expect(screen.getByText(FILE_MESSAGES.levelsMissing)).toBeVisible();

    expect(props.prepare).not.toHaveBeenCalled();
  });

  it("refuses a file over 50 MB in the browser", async () => {
    const props = setup();
    const big = pdf();
    Object.defineProperty(big, "size", { value: 51 * 1024 * 1024 });
    chooseFile(big);
    await submit();
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
