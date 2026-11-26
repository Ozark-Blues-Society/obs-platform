import { getRoles } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { MemberFileRow } from "./member-files-state";

// Reads for the members-only files screen (app/admin/files). Not a Server Function: anyone can
// call those, so keep this file free of "use server".

/** Whether the signed-in member manages members-only files: editors and administrators. */
export async function managesMemberFiles(userId: string): Promise<boolean> {
  const roles = await getRoles(userId);
  return roles.includes("editor") || roles.includes("admin");
}

type FileRecord = {
  id: string;
  title: string;
  file_name: string;
  size_bytes: number | null;
  audience: string;
  levels: string[] | null;
  created_at: string;
};

/**
 * Every members-only file, newest first. It reads as the signed-in member, so row level security
 * gives all of them only to an editor or administrator. Throws if they can't be read.
 */
export async function listMemberFiles(): Promise<MemberFileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_files")
    .select("id, title, file_name, size_bytes, audience, levels, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Listing members-only files failed: ${error.code} ${error.message}`);
  }
  return ((data ?? []) as FileRecord[]).map((row) => ({
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    audience: row.audience,
    levels: row.levels ?? [],
    createdAt: row.created_at,
  }));
}
