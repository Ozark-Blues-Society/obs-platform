import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag, type TagTone } from "@/components/ui/tag";
import {
  formatMembershipDate,
  joinedYear,
  levelTitle,
  statusLabel,
  type MembershipStanding,
} from "@/lib/members/membership";
import { JOIN_PATH } from "@/lib/site/navigation";

/**
 * The member's own membership on My Account (backlog M-8): level, status, renewal date and
 * auto-renew, and what to do when it's ending, has ended or hasn't started. Payments and auto-renew
 * are managed on the payment service's own pages, which M-6 links to from here.
 */
export function MembershipCard({
  membership,
  joinedAt,
}: {
  membership: MembershipStanding;
  /** profiles.joined_at. */
  joinedAt: string | null;
}) {
  return (
    <Card as="section" aria-labelledby="membership-heading" className="p-5.5">
      <p className="text-eyebrow text-accent-dark uppercase">Membership</p>
      <h2 id="membership-heading" className="mt-1.5 text-h3">
        {heading(membership)}
      </h2>
      <MembershipFacts membership={membership} joinedAt={joinedAt} />
    </Card>
  );
}

function heading(membership: MembershipStanding): string {
  switch (membership.kind) {
    case "none":
      return "Not a member yet";
    case "lapsed":
      return "Your membership has ended";
    case "active":
      return `${levelTitle(membership.level)} member`;
  }
}

/** The status tag's color: green while active, brass when it's time to renew, rust once ended. */
function statusTone(membership: Exclude<MembershipStanding, { kind: "none" }>): TagTone {
  if (membership.kind === "lapsed") return "danger";
  return membership.endsSoon ? "accent" : "success";
}

function MembershipFacts({ membership, joinedAt }: Parameters<typeof MembershipCard>[0]) {
  if (membership.kind === "none") {
    return (
      <>
        <p className="mt-3 text-sm">
          Join the Society for members-only events, member perks and the venue directory.
        </p>
        <NextStep href={JOIN_PATH}>Join the Society</NextStep>
      </>
    );
  }

  const date = formatMembershipDate(membership.expiresAt);
  const since = membership.kind === "active" ? joinedYear(joinedAt) : null;
  return (
    <>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
        {membership.level && (
          <>
            <dt className="font-semibold">Level</dt>
            <dd>{levelTitle(membership.level)}</dd>
          </>
        )}
        <dt className="font-semibold">Status</dt>
        <dd>
          <Tag tone={statusTone(membership)}>{statusLabel(membership)}</Tag>
        </dd>
        {membership.kind === "active" ? (
          <>
            <dt className="font-semibold">Renewal date</dt>
            <dd>{date}</dd>
            <dt className="font-semibold">Auto-renew</dt>
            <dd>{membership.autoRenew ? "On" : "Off"}</dd>
            {since && (
              <>
                <dt className="font-semibold">Member since</dt>
                <dd>{since}</dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="font-semibold">Ended on</dt>
            <dd>{date}</dd>
          </>
        )}
      </dl>
      {membership.kind === "lapsed" && (
        <>
          <p className="mt-4 text-sm">
            Renew to get your member perks and members-only events back.
          </p>
          <NextStep href={JOIN_PATH}>Renew your membership</NextStep>
        </>
      )}
      {membership.kind === "active" && membership.endsSoon && (
        <>
          <p className="mt-4 text-sm">Renew by {date} to keep your member perks.</p>
          <NextStep href={JOIN_PATH}>Renew now</NextStep>
        </>
      )}
    </>
  );
}

function NextStep({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="mt-4">
      <ButtonLink href={href} variant="dark" size="sm">
        {children}
      </ButtonLink>
    </p>
  );
}
