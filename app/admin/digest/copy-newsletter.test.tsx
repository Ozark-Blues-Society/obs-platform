import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyNewsletter } from "./copy-newsletter";

const HTML =
  '<!DOCTYPE html><html lang="en"><body><a href="{$unsubscribe}">Unsubscribe</a></body></html>';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("CopyNewsletter", () => {
  it("copies the newsletter's HTML and says so", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<CopyNewsletter html={HTML} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole("button", { name: "Copy the newsletter" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Copied. Now paste it into MailerLite."),
    );
    expect(writeText).toHaveBeenCalledWith(HTML);
  });

  it("empties the message while copying again, so screen readers announce it again", async () => {
    let finish = () => {};
    const writeText = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    stubClipboard(writeText);
    render(<CopyNewsletter html={HTML} />);
    const button = screen.getByRole("button", { name: "Copy the newsletter" });

    fireEvent.click(button);
    finish();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied."));
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
    finish();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied."));
  });

  it("points to the HTML to copy by hand when the browser won't copy", async () => {
    stubClipboard(async () => {
      throw new DOMException("Write permission denied.", "NotAllowedError");
    });
    render(<CopyNewsletter html={HTML} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy the newsletter" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Couldn't copy. Open “Show the HTML” below, select all of it and copy it.",
      ),
    );
    const box = screen.getByRole("textbox", { name: "The newsletter's HTML", hidden: true });
    expect(box).toHaveValue(HTML);
    expect(box).toHaveAttribute("readonly");
  });
});
