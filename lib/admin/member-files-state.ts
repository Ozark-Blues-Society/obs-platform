// The members-only files screen (app/admin/files, backlog M-7): the checks, names and wording its
// form, list and Server Functions share. No server code, so the form and the tests can use it.
import { isFileId } from "@/lib/members/files";
import { MEMBERSHIP_LEVELS, type MembershipLevel } from "@/sanity/schemas/options";

/** The most a file may weigh: the member-files bucket's limit (Supabase's free plan allows 50 MB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const FILE_MESSAGES = {
  notEditor:
    "Only editors and administrators can manage members-only files. If you need to, ask an administrator for the Editor role.",
  unavailable: "That didn't work. Please try again in a few minutes.",
  fileMissing: "Choose the file to upload.",
  fileEmpty: "That file is empty. Choose another one.",
  fileTooBig:
    "That file is over 50 MB. Make it smaller (for example, save a PDF at a lower quality).",
  titleMissing: "Give the file a name members will recognize.",
  titleTooLong: "Keep the name under 200 characters.",
  audienceMissing: "Choose who can download it.",
  levelsMissing: "Tick at least one membership level.",
  uploadFailed: "The upload didn't finish. Check your connection and try again.",
  notUploaded: "The upload didn't finish, so the file wasn't added. Please try again.",
} as const;

export type FileAudience = "members" | "levels";

export type AudienceChoice = { audience: FileAudience; levels: MembershipLevel[] };

/** Who can download a file, from the form's radio buttons and level checkboxes. */
export function parseAudience(
  audience: unknown,
  levels: unknown[],
): AudienceChoice | { problem: string } {
  if (audience === "members") return { audience: "members", levels: [] };
  if (audience !== "levels") return { problem: FILE_MESSAGES.audienceMissing };
  const ticked = MEMBERSHIP_LEVELS.map((level) => level.value).filter((level) =>
    levels.includes(level),
  );
  return ticked.length > 0
    ? { audience: "levels", levels: ticked }
    : { problem: FILE_MESSAGES.levelsMissing };
}

/** The name a file shows under, from the form: trimmed, or a problem to report. */
export function parseTitle(value: unknown): { title: string } | { problem: string } {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!title) return { problem: FILE_MESSAGES.titleMissing };
  if (title.length > 200) return { problem: FILE_MESSAGES.titleTooLong };
  return { title };
}

/** A file the browser is about to upload, or a problem to report before it starts. */
export function checkFile(file: { name: string; size: number } | null): string | null {
  if (!file || !file.name) return FILE_MESSAGES.fileMissing;
  if (file.size <= 0) return FILE_MESSAGES.fileEmpty;
  if (file.size > MAX_FILE_BYTES) return FILE_MESSAGES.fileTooBig;
  return null;
}

/**
 * The file's name with only the characters Storage keys allow everywhere: letters, digits, dots,
 * dashes and underscores, at most 120 of them, keeping the extension. The download keeps the
 * original name (member_files.file_name); this one is only for the bucket.
 */
export function safeObjectName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const plain = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!plain) return "file";
  if (plain.length <= 120) return plain;
  const dot = plain.lastIndexOf(".");
  const extension = dot > 0 && plain.length - dot <= 10 ? plain.slice(dot) : "";
  return plain.slice(0, 120 - extension.length) + extension;
}

/** The download name: the original file name, without any folder, at most 200 characters. */
export function downloadName(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? "").trim();
  return (base || "file").slice(0, 200);
}

/** A file's object in the bucket: a folder named after its id, then its safe name. */
export function objectPathFor(id: string, fileName: string): string {
  return `${id}/${safeObjectName(fileName)}`;
}

/** The file id at the start of an object path made by objectPathFor, or null for anything else. */
export function idFromObjectPath(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const match = /^([0-9a-f-]{36})\/[A-Za-z0-9._-]{1,120}$/.exec(path);
  return match && isFileId(match[1]) ? match[1] : null;
}

/** Who can download a file, in words: "Every member" or "Band, Business and Sponsor members". */
export function audienceLabel(audience: unknown, levels: unknown): string {
  if (audience === "members") return "Every member";
  const names = MEMBERSHIP_LEVELS.filter(
    (level) => Array.isArray(levels) && levels.includes(level.value),
  ).map((level) => level.title);
  if (audience !== "levels" || names.length === 0) return "Nobody (no level ticked)";
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} members`;
}

/** "2.4 MB", "830 KB", "120 bytes". */
export function formatBytes(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the screen lists for each file. */
export type MemberFileRow = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number | null;
  audience: string;
  levels: string[];
  createdAt: string;
};

export type PrepareUploadResult =
  { status: "ready"; path: string; uploadUrl: string } | { status: "error"; message: string };

export type SaveFileResult =
  { status: "saved"; id: string; message: string } | { status: "error"; message: string };

export type RemoveFileState =
  | { status: "idle" }
  | { status: "removed"; message: string }
  | { status: "error"; message: string };
