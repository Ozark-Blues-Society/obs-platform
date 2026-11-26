// Members-only files (decision 0001, backlog M-7): PDFs, documents and audio that only members may
// download. They live in a private Supabase Storage bucket, never in Sanity, which serves every
// upload publicly by URL. Each file has a row in public.member_files saying who may download it
// (supabase/migrations/20261126083600_member_files.sql). Kept free of server code so pages,
// components, the Studio and tests can import it.
import type { Visibility } from "./access";

/** The private Storage bucket that holds the files. */
export const MEMBER_FILES_BUCKET = "member-files";

/**
 * How long a download link from Storage works, in seconds: long enough for the browser to start
 * the download, too short to be worth passing around.
 */
export const DOWNLOAD_LINK_SECONDS = 60;

const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether `value` looks like a file's id: a UUID, as Postgres writes it. */
export function isFileId(value: unknown): value is string {
  return typeof value === "string" && FILE_ID.test(value);
}

/** Where a file downloads from on the site: the link editors put on a page, post or event. */
export function memberFilePath(id: string): string {
  return `/files/${id}`;
}

/** Who may download a file, as public.member_files stores it. */
export type FileAudience = { audience: unknown; levels: unknown };

/**
 * A file's audience in the shape lib/members/access.ts checks, so files follow the same rules as
 * pages, posts and events. Files are never for everyone: public files belong in Sanity.
 */
export function fileVisibility({ audience, levels }: FileAudience): Visibility {
  return {
    audience: audience === "members" || audience === "levels" ? audience : null,
    levels: Array.isArray(levels) ? levels.filter((level) => typeof level === "string") : [],
  };
}
