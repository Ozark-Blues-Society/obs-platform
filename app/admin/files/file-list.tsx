"use client";

import { useActionState } from "react";
import { errorClass, successBoxClass } from "@/components/form-classes";
import { Button } from "@/components/ui/button";
import {
  audienceLabel,
  formatBytes,
  type MemberFileRow,
  type RemoveFileState,
} from "@/lib/admin/member-files-state";
import { formatSocietyDate } from "@/lib/society-time";
import { CopyCodeButton } from "./copy-code-button";

type RemoveFileAction = (state: RemoveFileState, formData: FormData) => Promise<RemoveFileState>;

/**
 * The members-only files, newest first, each with its code and a Remove button. One form holds
 * every button, so the outcome stays on screen after the list refreshes.
 */
export function FileList({ files, action }: { files: MemberFileRow[]; action: RemoveFileAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="mt-4">
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {state.status === "removed" && <p className={`${successBoxClass} mb-4`}>{state.message}</p>}
      </div>
      {state.status === "error" && (
        <p role="alert" className={`${errorClass} mb-4`}>
          {state.message}
        </p>
      )}
      {files.length === 0 ? (
        <p className="text-muted">No files yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {files.map((file) => (
            <li key={file.id} className="px-4 py-3">
              <p className="font-semibold">{file.title}</p>
              <p className="text-small text-muted">
                {audienceLabel(file.audience, file.levels)} · {file.fileName}
                {file.sizeBytes !== null && `, ${formatBytes(file.sizeBytes)}`} · added{" "}
                {formatSocietyDate(file.createdAt)}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
                <span>
                  Code: <code className="break-all">{file.id}</code>
                </span>
                <CopyCodeButton code={file.id} label={`Copy code for ${file.title}`} />
                <Button
                  type="submit"
                  name="id"
                  value={file.id}
                  size="sm"
                  variant="reject"
                  disabled={pending}
                  aria-label={`Remove ${file.title}`}
                  onClick={(event) => {
                    const message = `Remove "${file.title}"? Links to it on the website will stop working.`;
                    if (!window.confirm(message)) event.preventDefault();
                  }}
                >
                  Remove
                </Button>
              </p>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
