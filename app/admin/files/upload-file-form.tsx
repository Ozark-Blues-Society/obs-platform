"use client";

import { useState, useTransition, type FormEvent } from "react";
import { successBoxClass } from "@/components/form-classes";
import { Button } from "@/components/ui/button";
import { CheckboxField, Fieldset, TextField } from "@/components/ui/form-fields";
import {
  FILE_MESSAGES,
  checkFile,
  parseAudience,
  parseTitle,
  type PrepareUploadResult,
  type SaveFileResult,
} from "@/lib/admin/member-files-state";
import { MEMBERSHIP_LEVELS } from "@/sanity/schemas/options";
import { CopyCodeButton } from "./copy-code-button";

// The Server Functions arrive as props (from page.tsx), so the form can be tested on its own.
type Props = {
  prepare: (file: { name: string; size: number }) => Promise<PrepareUploadResult>;
  save: (input: {
    path: string;
    fileName: string;
    title: string;
    audience: string;
    levels: string[];
  }) => Promise<SaveFileResult>;
  /** Sends the file to the one-time upload link; true when Storage accepted it. */
  upload?: (url: string, file: File) => Promise<boolean>;
};

type Field = "file" | "title" | "audience" | "levels";

type State =
  | { status: "idle" }
  | { status: "error"; field: Field | null; message: string }
  | { status: "saved"; id: string; message: string };

/**
 * Uploads a members-only file. The file goes straight from the browser to Storage, through a
 * one-time link the server makes for editors (lib/admin/member-files-actions.ts), so large files
 * never pass through the website's server.
 */
export function UploadFileForm({ prepare, save, upload = putFile }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [audience, setAudience] = useState("members");
  const [pending, startTransition] = useTransition();
  const errorOn = (field: Field | null) =>
    state.status === "error" && state.field === field ? state.message : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem("file");
    const file = input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
    const fail = (field: Field | null, message: string) =>
      setState({ status: "error", field, message });

    const fileProblem = checkFile(file);
    if (fileProblem || !file) return fail("file", fileProblem ?? FILE_MESSAGES.fileMissing);
    const title = parseTitle(data.get("title"));
    if ("problem" in title) return fail("title", title.problem);
    const who = parseAudience(data.get("audience"), data.getAll("levels"));
    if ("problem" in who) {
      return fail(who.problem === FILE_MESSAGES.levelsMissing ? "levels" : "audience", who.problem);
    }

    startTransition(async () => {
      const prepared = await prepare({ name: file.name, size: file.size });
      if (prepared.status === "error") return fail(null, prepared.message);
      if (!(await upload(prepared.uploadUrl, file))) return fail(null, FILE_MESSAGES.uploadFailed);
      const saved = await save({
        path: prepared.path,
        fileName: file.name,
        title: title.title,
        audience: who.audience,
        levels: who.levels,
      });
      if (saved.status === "error") return fail(null, saved.message);
      form.reset();
      setAudience("members");
      setState(saved);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex max-w-xl flex-col gap-5">
      <TextField
        type="file"
        name="file"
        label="File"
        hint="A PDF, document, spreadsheet, recording or any other file, up to 50 MB."
        error={errorOn("file")}
        required
      />
      <TextField
        name="title"
        label="Name"
        hint="What members will recognize, for example: November board minutes."
        error={errorOn("title")}
        maxLength={200}
        autoComplete="off"
        required
      />
      <Fieldset legend="Who can download it" error={errorOn("audience")}>
        {[
          { value: "members", label: "Every member, at any level" },
          { value: "levels", label: "Only some membership levels" },
        ].map((choice) => (
          <label key={choice.value} className="flex items-center gap-2">
            <input
              type="radio"
              name="audience"
              value={choice.value}
              checked={audience === choice.value}
              onChange={() => setAudience(choice.value)}
              className="size-4 accent-primary"
            />
            {choice.label}
          </label>
        ))}
        {audience === "levels" && (
          <Fieldset legend="Membership levels" error={errorOn("levels")} className="mt-2 ml-6">
            {MEMBERSHIP_LEVELS.map((level) => (
              <CheckboxField
                key={level.value}
                name="levels"
                value={level.value}
                label={level.title}
              />
            ))}
          </Fieldset>
        )}
      </Fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading..." : "Upload file"}
        </Button>
        {errorOn(null) && (
          <p role="alert" className="mt-2 text-small font-medium text-danger">
            {errorOn(null)}
          </p>
        )}
      </div>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {state.status === "saved" && (
          <div className={successBoxClass}>
            <p>{state.message}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              Code: <code className="break-all">{state.id}</code>
              <CopyCodeButton code={state.id} label="Copy the new file's code" />
            </p>
          </div>
        )}
      </div>
    </form>
  );
}

async function putFile(url: string, file: File): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" },
    });
    return response.ok;
  } catch {
    return false;
  }
}
