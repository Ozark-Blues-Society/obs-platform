"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { MEMBER_FILES_BUCKET, isFileId } from "@/lib/members/files";
import { createClient } from "@/lib/supabase/server";
import { managesMemberFiles } from "./member-files";
import {
  FILE_MESSAGES,
  checkFile,
  downloadName,
  idFromObjectPath,
  objectPathFor,
  parseAudience,
  parseTitle,
  type PrepareUploadResult,
  type RemoveFileState,
  type SaveFileResult,
} from "./member-files-state";

// The members-only files screen's Server Functions (app/admin/files, backlog M-7). Anyone can call
// a Server Function, so each checks the session and the Editor or Administrator role itself.
// Everything runs as the signed-in editor: row level security and the Storage policies enforce the
// same rule (supabase/migrations/20261126083600_member_files.sql).
//
// Adding a file takes three steps, so a large file goes straight from the browser to Storage and
// never through the website's server (hosts limit request sizes):
//   1. prepareUpload: a one-time upload link for a new object, `<new id>/<safe file name>`;
//   2. the browser uploads the file to that link;
//   3. saveUploadedFile: checks Storage has the file, then adds its row, which is what lets
//      members download it. Until then no member can.

const FILES_PAGE = "/admin/files";

/** Step 1: a one-time link to upload `fileName` to, if the editor may add files. */
export async function prepareUpload(file: {
  name: string;
  size: number;
}): Promise<PrepareUploadResult> {
  const user = await requireUser(FILES_PAGE);
  const problem = checkFile(file);
  if (problem) return { status: "error", message: problem };
  try {
    if (!(await managesMemberFiles(user.id))) {
      return { status: "error", message: FILE_MESSAGES.notEditor };
    }
    const path = objectPathFor(crypto.randomUUID(), file.name);
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(MEMBER_FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error("Preparing a members-only file upload failed:", error);
      return { status: "error", message: FILE_MESSAGES.unavailable };
    }
    return { status: "ready", path: data.path, uploadUrl: data.signedUrl };
  } catch (cause) {
    console.error("Preparing a members-only file upload failed:", cause);
    return { status: "error", message: FILE_MESSAGES.unavailable };
  }
}

/** Step 3: adds the row for a file the browser has uploaded to `path`. */
export async function saveUploadedFile(input: {
  path: string;
  fileName: string;
  title: string;
  audience: string;
  levels: string[];
}): Promise<SaveFileResult> {
  const user = await requireUser(FILES_PAGE);
  const id = idFromObjectPath(input.path);
  const title = parseTitle(input.title);
  const audience = parseAudience(input.audience, Array.isArray(input.levels) ? input.levels : []);
  if (!id) return { status: "error", message: FILE_MESSAGES.unavailable };
  if ("problem" in title) return { status: "error", message: title.problem };
  if ("problem" in audience) return { status: "error", message: audience.problem };

  try {
    if (!(await managesMemberFiles(user.id))) {
      return { status: "error", message: FILE_MESSAGES.notEditor };
    }
    const supabase = await createClient();
    const storage = supabase.storage.from(MEMBER_FILES_BUCKET);
    const { data: info, error: infoError } = await storage.info(input.path);
    if (infoError || !info) {
      return { status: "error", message: FILE_MESSAGES.notUploaded };
    }
    const { error } = await supabase.from("member_files").insert({
      id,
      title: title.title,
      object_path: input.path,
      file_name: downloadName(input.fileName),
      content_type: info.contentType ?? null,
      size_bytes: typeof info.size === "number" ? info.size : null,
      audience: audience.audience,
      levels: audience.levels,
    });
    refresh();
    if (error) {
      console.error("Adding a members-only file failed:", error.code, error.message);
      // No row, so no member can reach the file; don't leave it in the bucket either. Unless the
      // path is already a listed file's (a repeated request): that file must keep its object.
      const { data: listed } = await supabase
        .from("member_files")
        .select("id")
        .eq("object_path", input.path);
      if (listed && listed.length === 0) await storage.remove([input.path]);
      return { status: "error", message: FILE_MESSAGES.unavailable };
    }
    return {
      status: "saved",
      id,
      message: `Added "${title.title}". Copy its code into the Studio.`,
    };
  } catch (cause) {
    console.error("Adding a members-only file failed:", cause);
    return { status: "error", message: FILE_MESSAGES.unavailable };
  }
}

/** Removes a file: its row first, so members lose it at once, then the file itself. */
export async function removeMemberFile(
  _previous: RemoveFileState,
  formData: FormData,
): Promise<RemoveFileState> {
  const user = await requireUser(FILES_PAGE);
  const id = formData.get("id");
  if (!isFileId(id)) {
    // The page never sends this, so someone made the request up.
    return { status: "error", message: FILE_MESSAGES.unavailable };
  }
  try {
    if (!(await managesMemberFiles(user.id))) {
      return { status: "error", message: FILE_MESSAGES.notEditor };
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("member_files")
      .delete()
      .eq("id", id)
      .select("title, object_path");
    refresh();
    if (error) {
      console.error("Removing a members-only file failed:", error.code, error.message);
      return { status: "error", message: FILE_MESSAGES.unavailable };
    }
    const [removed] = (data ?? []) as { title: string; object_path: string }[];
    if (!removed) {
      return { status: "removed", message: "That file was already removed." };
    }
    const { error: storageError } = await supabase.storage
      .from(MEMBER_FILES_BUCKET)
      .remove([removed.object_path]);
    if (storageError) {
      // Members can't reach it without its row; it only takes up space.
      console.error("Removing a members-only file from Storage failed:", storageError);
    }
    return { status: "removed", message: `Removed "${removed.title}".` };
  } catch (cause) {
    console.error("Removing a members-only file failed:", cause);
    return { status: "error", message: FILE_MESSAGES.unavailable };
  }
}
