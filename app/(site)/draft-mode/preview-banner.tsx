"use client";

import { useSyncExternalStore } from "react";
import { exitPreview } from "./actions";

const subscribe = () => () => {};
// In the Studio's Presentation tool the page is framed (or opened from the Studio), and the Studio
// has its own controls. The banner is for people who opened a shared preview link.
const isStandalone = () => window.self === window.top && !window.opener;

/** Tells a draft-mode visitor they're seeing unpublished changes, with a way out. */
export function PreviewBanner() {
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => false);
  if (!standalone) {
    return null;
  }

  return (
    <aside
      aria-label="Preview"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-accent-soft px-4 py-2 text-center text-sm text-ink"
    >
      <p>You&rsquo;re viewing a preview that includes unpublished changes.</p>
      <form action={exitPreview}>
        <button
          type="submit"
          className="rounded bg-primary-dark px-3 py-1 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
        >
          Exit preview
        </button>
      </form>
    </aside>
  );
}
