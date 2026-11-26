"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Copies the newsletter's HTML, for pasting into MailerLite's custom HTML editor. If the browser
 * won't copy, the HTML is also in a box to select and copy by hand.
 */
export function CopyNewsletter({ html }: { html: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    // Emptied first, so a second copy's message is announced again.
    setMessage("");
    try {
      await navigator.clipboard.writeText(html);
      setMessage("Copied. Now paste it into MailerLite.");
    } catch {
      setMessage("Couldn't copy. Open “Show the HTML” below, select all of it and copy it.");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={copy}>Copy the newsletter</Button>
        {/* Always in the page, so screen readers announce the message when it appears. */}
        <p role="status" className="text-small text-muted">
          {message}
        </p>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm">Show the HTML</summary>
        <textarea
          readOnly
          value={html}
          rows={8}
          aria-label="The newsletter's HTML"
          className="mt-2 w-full rounded-lg border border-line-strong bg-white p-3 font-mono text-small text-ink"
        />
      </details>
    </div>
  );
}
