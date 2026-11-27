import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Modal, tabbableElements } from "./modal";

// jsdom has <dialog> and its `open` attribute but not showModal() or close(). These stand-ins only
// open and close it; what's under test (focus, Tab, Escape, onClose) is the component's own. Like
// browsers, close() fires its `close` event later, as a task of its own: an event fired at once
// would hide bugs that depend on that order.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    setTimeout(() => this.dispatchEvent(new Event("close")), 0);
  };
});

/** Waits until the `close` events that close() queued have reached their dialogs. */
async function closeEventsDelivered() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

function Harness({ onClose = () => {}, autofocus = false, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Post a listing
      </button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="New listing"
      >
        <label>
          Title <input name="title" data-autofocus={autofocus || undefined} />
        </label>
        <button type="button">Submit for review</button>
      </Modal>
    </>
  );
}

/** Renders the harness and opens the modal from its trigger, as a keyboard user would. */
function openModal(props: Parameters<typeof Harness>[0] = {}) {
  render(<Harness {...props} />);
  const trigger = screen.getByRole("button", { name: "Post a listing" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole<HTMLDialogElement>("dialog", { name: "New listing" });
  return { trigger, dialog };
}

describe("Modal", () => {
  it("opens as a dialog named by its title, with focus on its first control", () => {
    const { dialog } = openModal();

    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("heading", { level: 2, name: "New listing" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("starts focus on the element marked data-autofocus", () => {
    openModal({ autofocus: true });
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
  });

  it("traps focus: Tab from the last control goes to the first, Shift+Tab back", () => {
    openModal();
    const close = screen.getByRole("button", { name: "Close" });
    const submit = screen.getByRole("button", { name: "Submit for review" });

    submit.focus();
    expect(fireEvent.keyDown(submit, { key: "Tab" })).toBe(false); // default prevented
    expect(close).toHaveFocus();

    expect(fireEvent.keyDown(close, { key: "Tab", shiftKey: true })).toBe(false);
    expect(submit).toHaveFocus();
  });

  it("leaves Tab alone between the first and last controls", () => {
    openModal();
    const title = screen.getByRole("textbox", { name: "Title" });
    title.focus();

    expect(fireEvent.keyDown(title, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(title, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("closes on Escape and puts focus back on the trigger", async () => {
    const onClose = vi.fn();
    const { trigger, dialog } = openModal({ onClose });
    const title = screen.getByRole("textbox", { name: "Title" });
    title.focus();

    expect(fireEvent.keyDown(title, { key: "Escape" })).toBe(false);
    await closeEventsDelivered();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes from the × button", async () => {
    const onClose = vi.fn();
    const { trigger, dialog } = openModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await closeEventsDelivered();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("sends the browser's own close request (cancel) through onClose", async () => {
    const onClose = vi.fn();
    const { dialog } = openModal({ onClose });

    const notPrevented = fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await closeEventsDelivered();

    expect(notPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("calls onClose once when the browser closes the dialog itself", async () => {
    const onClose = vi.fn();
    const { dialog } = openModal({ onClose });

    dialog.close();
    await closeEventsDelivered();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("stays open when it opens with the page, though StrictMode runs its effect twice", async () => {
    // In development, StrictMode (which the App Router turns on) runs the effect, its cleanup and
    // the effect again: showModal(), close(), showModal(). The cleanup's close event arrives after
    // the dialog has opened again, and mustn't close it.
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Harness onClose={onClose} initiallyOpen />
      </StrictMode>,
    );
    await closeEventsDelivered();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "New listing" })).toHaveAttribute("open");
  });
});

describe("tabbableElements", () => {
  it("skips disabled, hidden, inert and tabindex=-1 elements", () => {
    const { container } = render(
      <div>
        <a href="#events">Events</a>
        <a>No href</a>
        <button type="button" disabled>
          Disabled
        </button>
        <input type="hidden" />
        <input aria-label="Name" />
        <div tabIndex={-1}>Programmatic focus only</div>
        <div tabIndex={0}>Focusable div</div>
        <div inert>
          <button type="button">Inert</button>
        </div>
      </div>,
    );

    expect(tabbableElements(container).map((element) => element.textContent || "input")).toEqual([
      "Events",
      "input",
      "Focusable div",
    ]);
  });
});
