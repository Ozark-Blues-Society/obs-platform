// Who can see members-only content (decision 0001, backlog M-7). These are plain rules with no
// server code, so the content module (sanity/content), pages, components and tests share them.
//
// A page, post or event is for one of three audiences (sanity/schemas/objects/visibility.ts):
//   - everyone: anyone;
//   - members: a member whose membership is active, at any level;
//   - levels: an active member at one of the listed levels.
// A membership is active until expires_at, with no grace period (board-decisions §4). Anything
// else, such as a missing or unknown audience, is open to nobody: the rules fail closed.

import { MEMBERSHIP_LEVELS, type MembershipLevel } from "@/sanity/schemas/options";

/** A page's, post's or event's "Who can see this?" as Sanity returns it (any field may be absent). */
export type Visibility = {
  audience?: string | null;
  levels?: readonly string[] | null;
};

/** Who is looking: a visitor, or a signed-in member with their membership from profiles. */
export type Viewer =
  | { kind: "visitor" }
  | {
      kind: "member";
      userId: string;
      /** profiles.level: null until the first payment. */
      level: MembershipLevel | null;
      /** profiles.expires_at as an ISO 8601 timestamp: null until the first payment. */
      expiresAt: string | null;
    };

export const VISITOR: Viewer = { kind: "visitor" };

export function isMembershipLevel(value: unknown): value is MembershipLevel {
  return MEMBERSHIP_LEVELS.some((level) => level.value === value);
}

/**
 * The viewer's membership level while their membership is active, otherwise null. Active means
 * a level and an expires_at that is still in the future.
 */
export function activeLevel(viewer: Viewer, now: Date): MembershipLevel | null {
  if (viewer.kind !== "member" || !viewer.level || !viewer.expiresAt) return null;
  const expires = Date.parse(viewer.expiresAt);
  return Number.isFinite(expires) && expires > now.getTime() ? viewer.level : null;
}

/** Why the viewer can't see an item, which decides what the lock says. */
export type LockReason =
  /** A visitor: sign in, or join. */
  | "sign-in"
  /** Signed in but not a member yet: join. */
  | "join"
  /** The membership has ended: renew. */
  | "renew"
  /** An active member, but the item is for other levels. */
  | "level";

export type Access = { allowed: true } | { allowed: false; reason: LockReason };

/** Whether `viewer` can see an item with this visibility at `now`. */
export function checkAccess(
  visibility: Visibility | null | undefined,
  viewer: Viewer,
  now: Date,
): Access {
  const audience = visibility?.audience;
  if (audience === "everyone") return { allowed: true };
  if (viewer.kind === "visitor") return { allowed: false, reason: "sign-in" };

  const level = activeLevel(viewer, now);
  if (!level) {
    const expires = viewer.expiresAt === null ? Number.NaN : Date.parse(viewer.expiresAt);
    return { allowed: false, reason: expires <= now.getTime() ? "renew" : "join" };
  }
  if (audience === "members") return { allowed: true };
  if (audience === "levels" && visibility?.levels?.includes(level)) return { allowed: true };
  return { allowed: false, reason: "level" };
}
