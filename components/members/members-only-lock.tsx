import { ButtonLink } from "@/components/ui/button";
import { LockOverlay } from "@/components/ui/lock-overlay";
import type { LockReason, Visibility } from "@/lib/members/access";
import { MEMBERSHIP_LEVELS } from "@/sanity/schemas/options";

type Thing = "page" | "post" | "event" | "directory";

/**
 * What someone who can't see a members-only page, post or event, or the venue directory, gets
 * instead (decision 0001, backlog M-7 and M-9), worded for why: `access.reason` from
 * sanity/content's loaders. It takes no content: the server never fetched it.
 * - sign-in: a visitor. Sign in (and come back to `returnTo`), or join.
 * - join: signed in, never a member. Join.
 * - renew: the membership has ended. Renew.
 * - level: an active member, but the item is for other levels. Say which.
 */
export function MembersOnlyLock({
  reason,
  visibility,
  thing,
  returnTo,
  headingLevel = 2,
}: {
  reason: LockReason;
  visibility: Visibility;
  thing: Thing;
  /** This page's path, for coming back after signing in. */
  returnTo: string;
  headingLevel?: 2 | 3;
}) {
  const read = thing === "post" ? "read it" : "see it";
  const levels = visibility.audience === "levels" ? levelTitles(visibility.levels ?? []) : "";
  const forWhom = `This ${thing} is for ${levels ? `${levels} members` : "members"}`;
  const common = { headingLevel, joinHref: "/join" };

  switch (reason) {
    case "sign-in":
      return (
        <LockOverlay
          {...common}
          title={forWhom}
          description={`Sign in or join to ${read}.`}
          signInHref={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        />
      );
    case "join":
      return (
        <LockOverlay
          {...common}
          title={forWhom}
          description={`Join the Society to ${read}.`}
          actions={
            <ButtonLink href="/join" size="sm">
              Join now
            </ButtonLink>
          }
        />
      );
    case "renew":
      return (
        <LockOverlay
          {...common}
          title="Your membership has ended"
          description={`Renew it to ${read}, and everything else for members.`}
          actions={
            <ButtonLink href="/join" size="sm">
              Renew
            </ButtonLink>
          }
        />
      );
    case "level":
      return (
        <LockOverlay
          {...common}
          title={forWhom}
          description="It isn't part of your membership level."
          actions={
            <ButtonLink href="/join" variant="dark" size="sm">
              See membership levels
            </ButtonLink>
          }
        />
      );
  }
}

/** "Band, Business and Sponsor" for those levels, in the board's order; empty for none. */
export function levelTitles(levels: readonly string[]): string {
  const names = MEMBERSHIP_LEVELS.filter((level) => levels.includes(level.value)).map(
    (level) => level.title,
  );
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
