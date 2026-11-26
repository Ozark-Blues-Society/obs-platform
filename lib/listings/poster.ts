import "server-only";
import { checkAccess, isMembershipLevel, type Access } from "@/lib/members/access";
import { createClient } from "@/lib/supabase/server";

// Reads for the "Post a listing" page and its Server Functions (backlog K-1). Not a Server
// Function file: anyone can call those, so keep this one free of "use server".

/** What posting depends on: the member's membership, and the phone number on their profile. */
export type Poster = {
  userId: string;
  /** profiles.level: null until the first payment. */
  level: string | null;
  /** profiles.expires_at: null until the first payment. */
  expiresAt: string | null;
  phone: string | null;
};

/**
 * The signed-in member `userId` as a poster. It reads as the member, whom row level security lets
 * read only their own profile. Throws if the profile can't be read.
 */
export async function getPoster(userId: string): Promise<Poster> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("level, expires_at, phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Reading the member's profile failed: ${error.code} ${error.message}`);
  }
  const profile = (data ?? {}) as { level?: unknown; expires_at?: unknown; phone?: unknown };
  return {
    userId,
    level: typeof profile.level === "string" ? profile.level : null,
    expiresAt: typeof profile.expires_at === "string" ? profile.expires_at : null,
    phone: typeof profile.phone === "string" && profile.phone.trim() ? profile.phone : null,
  };
}

/**
 * Whether the poster may post at `now`: an active membership at any level (board-decisions §7),
 * the same rule as members-only content. Otherwise the reason is "join" (never paid) or "renew"
 * (the membership has ended). Row level security and the Storage policies enforce it too.
 */
export function postingAccess(poster: Poster, now: Date): Access {
  return checkAccess(
    { audience: "members" },
    {
      kind: "member",
      userId: poster.userId,
      level: isMembershipLevel(poster.level) ? poster.level : null,
      expiresAt: poster.expiresAt,
    },
    now,
  );
}
