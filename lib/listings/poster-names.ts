import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { posterName } from "./moderation-state";

// The posters' names on the classifieds (K-3) and in the moderation queue (K-2). Visitors, members
// and moderators can't read other members' profiles, so the names come through the service role,
// which reads only the name columns here, after the caller has decided to show them.

/**
 * The posters' first names and last initials ("Pat W."), by profile id. Pages work without them,
 * so a failure is logged and gives no names.
 */
export async function posterNames(profileIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (profileIds.length === 0) return names;
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...new Set(profileIds)]);
    if (error) throw new Error(`${error.code} ${error.message}`);
    for (const row of (data ?? []) as { id: string; first_name: unknown; last_name: unknown }[]) {
      const name = posterName(row.first_name, row.last_name);
      if (name) names.set(row.id, name);
    }
  } catch (cause) {
    console.error("Reading the posters' names failed:", cause);
  }
  return names;
}
