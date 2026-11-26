"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
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

/** A field a check can fail on: also the name of its control(s) in the form. */
type Field = "file" | "title" | "audience" | "levels";

type State =
  | { status: "idle" }
  | { status: "error"; field: Field | null; message: string; announce?: boolean }
  | { status: "saved"; id: string; message: string };

/** Where focus goes when a check fails on `field`: its first control. */
function controlOf(form: HTMLFormElement | null, field: Field) {
  return form?.querySelector<HTMLElement>(`[name="${field}"]`) ?? null;
}

/**
 * Uploads a members-only file. The file goes straight from the browser to Storage, through a
 * one-time link the server makes for editors (lib/admin/member-files-actions.ts), so large files
 * never pass through the website's server.
 */
export function UploadFileForm({ prepare, save, upload = putFile }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [audience, setAudience] = useState("members");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const levelsErrorId = useId();
  const errorOn = (field: Field | null) =>
    state.status === "error" && state.field === field ? state.message : undefined;
  // A field's message, as an alert when focus couldn't move to the field (see `fail`). The key
  // makes an alert a new element, which screen readers announce, even if the same text was there.
  const fieldError = (field: Field, id?: string) => {
    const message = errorOn(field);
    if (!message) return undefined;
    const announce = state.status === "error" && state.announce;
    return (
      <span key={announce ? "alert" : "text"} id={id} role={announce ? "alert" : undefined}>
        {message}
      </span>
    );
  };

  // When a check fails, focus goes to the field to fix, after the message has rendered: the
  // field's description then includes it, so screen readers read it out. Keyed on the state
  // itself, so the same failure twice moves focus again.
  useEffect(() => {
    if (state.status === "error" && state.field) controlOf(formRef.current, state.field)?.focus();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem("file");
    const file = input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
    // Focus can't move to a field that already has it (Enter in an empty Name box), and nothing
    // would be read out, so that message is announced instead.
    const fail = (field: Field | null, message: string) =>
      setState({
        status: "error",
        field,
        message,
        announce: field !== null && controlOf(form, field) === document.activeElement,
      });

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
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="mt-6 flex max-w-xl flex-col gap-5"
    >
      <TextField
        type="file"
        name="file"
        label="File"
        hint="A PDF, document, spreadsheet, recording or any other file, up to 50 MB."
        error={fieldError("file")}
        required
      />
      <TextField
        name="title"
        label="Name"
        hint="What members will recognize, for example: November board minutes."
        error={fieldError("title")}
        maxLength={200}
        autoComplete="off"
        required
      />
      <Fieldset legend="Who can download it" error={fieldError("audience")}>
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
          <Fieldset
            legend="Membership levels"
            error={fieldError("levels", levelsErrorId)}
            className="mt-2 ml-6"
          >
            {MEMBERSHIP_LEVELS.map((level, index) => (
              <CheckboxField
                key={level.value}
                name="levels"
                value={level.value}
                label={level.title}
                // A group's own description isn't read reliably when focus enters it, so the
                // message also describes the first box, where focus goes when none is ticked.
                aria-describedby={index === 0 && errorOn("levels") ? levelsErrorId : undefined}
              />
            ))}
          </Fieldset>
        )}
      </Fieldset>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload file"}
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
              <CopyCodeButton code={state.id} label="Copy code for the new file" />
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
