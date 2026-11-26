"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Copies a file's code for pasting into the Studio. The code is also shown as text beside it, for
 * when the browser won't allow copying.
 */
export function CopyCodeButton({ code, label }: { code: string; label: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Code copied.");
    } catch {
      setMessage("Couldn't copy: select the code and copy it instead.");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" onClick={copy} aria-label={label}>
        Copy code
      </Button>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <span role="status" className="text-small text-muted">
        {message}
      </span>
    </span>
  );
}
