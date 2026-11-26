"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

type ToastProviderProps = {
  children: ReactNode;
  /** How long a message stays, in milliseconds. */
  duration?: number;
};

/**
 * Shows short confirmations ("Saved", "Link copied") at the bottom of the screen, one at a time.
 * Put it around the part of the app that calls `useToast()`. Its live region is always in the
 * page, so screen readers announce each message as it appears.
 *
 * Not while a `Modal` is open: the dialog makes the rest of the page inert, this live region
 * included, so screen readers don't announce the message, and its backdrop covers the toast.
 * Close the modal, then show the toast, or confirm inside the dialog.
 */
export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message) => {
    nextId.current += 1;
    setToast({ id: nextId.current, message });
  }, []);

  // Each new message restarts the clock.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          // The transparent border outlines the toast in forced-colors mode, which drops its
          // background.
          <p
            key={toast.id}
            className="max-w-[90vw] rounded-card border border-transparent bg-primary-dark px-4.5 py-3 text-sm text-white shadow-card transition duration-250 motion-reduce:transition-none starting:translate-y-5 starting:opacity-0"
          >
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext>
  );
}

/**
 * Returns `toast(message)`, which shows a message. Needs a `<ToastProvider>` above. Don't call it
 * while a `Modal` is open (see `ToastProvider`).
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast() needs a <ToastProvider> around the component");
  return show;
}
