import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/user";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isMembershipLevel, VISITOR, type Viewer } from "./access";

/**
 * Who is making this request: a visitor, or the signed-in member with their membership level and
 * expires_at. The membership is read from profiles on every request, never cached across
 * requests, so access ends at expires_at even in the middle of a session. Row level security lets
 * a member read only their own profile.
 *
 * It reads the session, so under Cache Components call it inside a <Suspense> boundary. Throws if
 * the profile can't be read.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  // Without Supabase settings (a preview made before the Society's accounts exist), nobody can be
  // signed in.
  if (!readSupabaseConfig()) return VISITOR;
  const user = await getCurrentUser();
  if (!user) return VISITOR;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("level, expires_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    throw new Error(`Reading the member's profile failed: ${error.code} ${error.message}`);
  }
  const profile = (data ?? {}) as { level?: unknown; expires_at?: unknown };
  return {
    kind: "member",
    userId: user.id,
    level: isMembershipLevel(profile.level) ? profile.level : null,
    expiresAt: typeof profile.expires_at === "string" ? profile.expires_at : null,
  };
});
