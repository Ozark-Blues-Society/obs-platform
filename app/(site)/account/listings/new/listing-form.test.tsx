import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LISTING_MESSAGES, type SubmitListingResult } from "@/lib/listings/listing-state";
import { ListingForm } from "./listing-form";

const PHOTO_PATH = "00000000-0000-4000-8100-000000000019/3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b.jpg";

function setup(overrides: Partial<Parameters<typeof ListingForm>[0]> = {}) {
  const props = {
    prepare: vi.fn(async () => ({
      status: "ready" as const,
      path: PHOTO_PATH,
      uploadUrl: "http://storage/upload?token=t",
    })),
    upload: vi.fn(async () => true),
    submit: vi.fn(async (): Promise<SubmitListingResult> => ({
      status: "submitted",
      title: "Tweed-style amp",
    })),
    phone: null as string | null,
    ...overrides,
  };
  render(<ListingForm {...props} />);
  return props;
}

function fillIn({ photo }: { photo?: File } = {}) {
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "gear" } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Tweed-style amp" } });
  fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Hand-wired." } });
  fireEvent.change(screen.getByLabelText("Price (optional)"), { target: { value: "650" } });
  if (photo) choosePhoto(photo);
}

function choosePhoto(file: File) {
  const input = screen.getByLabelText("Photo (optional)") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

const jpeg = () => new File(["jpeg bytes"], "amp.jpg", { type: "image/jpeg" });

/** Presses Submit for review, which takes focus first, as a click or a key press on it does. */
async function submit() {
  const button = screen.getByRole("button", { name: /Submit for review|Sending/ });
  button.focus();
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("ListingForm", () => {
  it("sends a listing without a photo and says it's waiting for a moderator", async () => {
    const props = setup();
    fillIn();
    await submit();

    await waitFor(() => expect(props.submit).toHaveBeenCalledOnce());
    expect(props.submit).toHaveBeenCalledWith({
      category: "gear",
      title: "Tweed-style amp",
      body: "Hand-wired.",
      price: "650",
      contactPref: "email",
      photoPath: null,
    });
    expect(props.prepare).not.toHaveBeenCalled();
    expect(props.upload).not.toHaveBeenCalled();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(
      "Thanks! “Tweed-style amp” is waiting for a moderator. We’ll email you once it’s been reviewed, and My listings shows where it stands.",
    );
    expect(within(status).getByRole("link", { name: "My listings" })).toHaveAttribute(
      "href",
      "/account/listings",
    );
    // Ready for another listing.
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Category")).toHaveValue("");
  });

  it("uploads the photo to the one-time link first, then sends the listing with it", async () => {
    const props = setup();
    fillIn({ photo: jpeg() });
    await submit();

    await waitFor(() => expect(props.submit).toHaveBeenCalledOnce());
    expect(props.prepare).toHaveBeenCalledWith({ size: 10, type: "image/jpeg" });
    expect(props.upload).toHaveBeenCalledWith("http://storage/upload?token=t", expect.any(File));
    expect(props.submit).toHaveBeenCalledWith(expect.objectContaining({ photoPath: PHOTO_PATH }));
  });

  it("moves focus to the first field to fix, whose description then holds the message", async () => {
    const props = setup();
    await submit();
    const category = screen.getByLabelText("Category");
    expect(category).toHaveFocus();
    expect(category).toHaveAccessibleDescription(LISTING_MESSAGES.categoryMissing);

    fillIn();
    fireEvent.change(screen.getByLabelText("Price (optional)"), { target: { value: "cheap" } });
    await submit();
    const price = screen.getByLabelText("Price (optional)");
    expect(price).toHaveFocus();
    expect(price).toHaveAccessibleDescription(
      expect.stringContaining(LISTING_MESSAGES.priceInvalid),
    );
    expect(props.submit).not.toHaveBeenCalled();
  });

  it("checks the photo before uploading anything", async () => {
    const props = setup();
    fillIn({ photo: new File(["gif"], "amp.gif", { type: "image/gif" }) });
    await submit();
    const photo = screen.getByLabelText("Photo (optional)");
    expect(photo).toHaveFocus();
    expect(photo).toHaveAccessibleDescription(expect.stringContaining(LISTING_MESSAGES.photoType));
    expect(props.prepare).not.toHaveBeenCalled();
  });

  it("announces the message when focus is already on the field to fix", async () => {
    setup();
    fillIn();
    const title = screen.getByLabelText("Title");
    fireEvent.change(title, { target: { value: "   " } });
    title.focus();
    await act(async () => {
      fireEvent.submit(title.closest("form") as HTMLFormElement);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(LISTING_MESSAGES.titleMissing);
  });

  it("offers no phone contact when the profile has no phone number", async () => {
    setup();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(
      screen.getByText(/People will contact you by email, through this website/),
    ).toBeInTheDocument();
  });

  it("offers phone contact at the profile's number, and sends the choice", async () => {
    const props = setup({ phone: "(479) 555-0119" });
    expect(screen.getByLabelText(/By email, through this website/)).toBeChecked();
    fillIn();
    fireEvent.click(
      screen.getByLabelText("By phone, at (479) 555-0119 (the number on your profile)."),
    );
    await submit();
    await waitFor(() =>
      expect(props.submit).toHaveBeenCalledWith(expect.objectContaining({ contactPref: "phone" })),
    );
  });

  it("shows the server's message on its field, or for the whole form", async () => {
    const submitListing = vi.fn(async (): Promise<SubmitListingResult> => ({
      status: "error",
      field: "title",
      message: LISTING_MESSAGES.titleTooLong,
    }));
    setup({ submit: submitListing });
    fillIn();
    await submit();
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription(
      expect.stringContaining(LISTING_MESSAGES.titleTooLong),
    );

    submitListing.mockResolvedValueOnce({
      status: "error",
      field: null,
      message: LISTING_MESSAGES.renew,
    });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(LISTING_MESSAGES.renew);
  });

  it("doesn't send the listing when the photo upload fails", async () => {
    const props = setup({ upload: vi.fn(async () => false) });
    fillIn({ photo: jpeg() });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(LISTING_MESSAGES.uploadFailed);
    expect(props.submit).not.toHaveBeenCalled();
  });

  it("keeps the button focusable but unavailable while sending, and ignores a second press", async () => {
    let answer: (result: SubmitListingResult) => void = () => {};
    const props = setup({
      submit: vi.fn(
        () =>
          new Promise<SubmitListingResult>((resolve) => {
            answer = resolve;
          }),
      ),
    });
    fillIn();
    await submit();
    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    await submit();
    await act(async () => answer({ status: "submitted", title: "Tweed-style amp" }));
    expect(await screen.findByRole("button", { name: "Submit for review" })).toBeInTheDocument();
    expect(props.submit).toHaveBeenCalledOnce();
  });
});
