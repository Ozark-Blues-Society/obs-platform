"use client";

import { useRouter } from "next/navigation";
import { VisualEditing } from "next-sanity/visual-editing";

/**
 * Click-to-edit overlays and live preview inside the Studio's Presentation tool. The browser holds
 * no Sanity token (sanity/live.ts), so there's no live draft connection here. Instead the Studio
 * reports every edit, and the page re-renders on the server, which reads the latest drafts.
 */
export function PreviewVisualEditing() {
  const router = useRouter();

  return (
    <VisualEditing
      refresh={() => {
        router.refresh();
        // Settle after a moment so the Studio's refresh indicator doesn't spin forever.
        return new Promise((resolve) => setTimeout(resolve, 1000));
      }}
    />
  );
}
