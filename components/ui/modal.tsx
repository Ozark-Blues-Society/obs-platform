"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";

const TABBABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

/** The elements inside `root` that Tab stops on, in document order. */
export function tabbableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest("[inert]") &&
      // Browsers skip elements that aren't rendered. jsdom has no layout (or checkVisibility).
      (typeof element.checkVisibility !== "function" || element.checkVisibility()),
  );
}

type ModalProps = {
  /** Shows the dialog. The parent owns this state and sets it to false in `onClose`. */
  open: boolean;
  /** Called for the × button, the Escape key and the browser's own close requests. */
  onClose: () => void;
  /** The dialog's heading, which also names it for screen readers. */
  title: ReactNode;
  children: ReactNode;
  /** The × button's name for screen readers. */
  closeLabel?: string;
};

/**
 * A modal dialog over a dimmed page, built on `<dialog>`: the rest of the page can't be clicked or
 * reached while it's open. Tab and Shift+Tab cycle through the dialog's controls, Escape closes it,
 * and focus goes back to where it was. Focus starts on the first control, or on the element with a
 * `data-autofocus` attribute.
 */
export function Modal({ open, onClose, title, children, closeLabel = "Close" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A layout effect, so the dialog opens and closes in the same frame as the page update. A toast
  // shown while closing then isn't inside an inert page, where screen readers would skip it.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const returnFocusTo = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const first =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      tabbableElements(dialog)[0] ??
      dialog;
    first.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) returnFocusTo.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      // Stops the browser closing the dialog itself: the parent's state decides.
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = event.currentTarget;
    const items = tabbableElements(dialog);
    const active = document.activeElement;
    if (items.length === 0) {
      event.preventDefault();
    } else if (event.shiftKey && (active === items[0] || active === dialog)) {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (!event.shiftKey && active === items[items.length - 1]) {
      event.preventDefault();
      items[0].focus();
    }
  }

  // Other close requests (such as Android's back gesture) arrive as a cancel event.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  // The browser can still close the dialog itself; keep the parent's state in step. The close event
  // arrives later, as a task of its own, so skip one that finds the dialog open again: in
  // development, StrictMode runs the effect above twice at mount (showModal(), close(),
  // showModal()), and that close event would shut a dialog that opens with the page.
  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (open && !event.currentTarget.open) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-140 overflow-y-auto rounded-card border border-line bg-surface p-7 text-ink shadow-card backdrop:bg-primary-dark/55"
    >
      {open && (
        <>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="absolute top-2.5 right-3.5 inline-flex size-9 items-center justify-center rounded-full text-2xl leading-none text-muted hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
          <h2 id={titleId} className="mb-3 pr-8">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
