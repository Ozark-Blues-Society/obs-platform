import { Card } from "@/components/ui/card";
import { levelTitle, type MembershipStanding } from "@/lib/members/membership";
import type { MemberPerks } from "@/sanity/content/member-perks";

/**
 * The member's perks on My Account (backlog M-8): the perk codes and benefits of their level, from
 * Site settings (board-decisions §1 and §5). Members-only: getMemberPerks fetches them only for an
 * active membership, so for anyone else there's nothing here to show or hide.
 */
export function PerksCard({
  membership,
  perks,
}: {
  membership: MembershipStanding;
  perks: MemberPerks;
}) {
  return (
    <Card as="section" aria-labelledby="perks-heading" className="p-5.5">
      <p className="text-eyebrow text-accent-dark uppercase">Your perks</p>
      <h2 id="perks-heading" className="mt-1.5 text-h3">
        Member perks
      </h2>
      <Perks membership={membership} perks={perks} />
    </Card>
  );
}

function Perks({ membership, perks }: Parameters<typeof PerksCard>[0]) {
  const { level, benefits, perkCodes } = perks;
  if (level === null) {
    return (
      <p className="mt-3 text-sm">
        {membership.kind === "lapsed"
          ? "Your perk codes and member benefits come back when you renew."
          : "Your perk codes and member benefits will appear here once you join."}
      </p>
    );
  }
  if (perks.unavailable) {
    return (
      <p className="mt-3 text-sm">
        Your perks can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }
  if (benefits.length === 0 && perkCodes.length === 0) {
    return <p className="mt-3 text-sm text-muted">Your perks will appear here soon.</p>;
  }
  return (
    <>
      {perkCodes.length > 0 && (
        <dl className="mt-4 space-y-4">
          {perkCodes.map((perk) => (
            <div key={perk.key}>
              <dt className="text-sm font-semibold">{perk.label}</dt>
              {/* A long code wraps at its hyphens first, and mid-code only if it must. */}
              <dd className="mt-1.5 rounded-lg bg-canvas p-2.5 text-center font-mono text-xl tracking-widest wrap-anywhere">
                {perk.code}
              </dd>
              {perk.details && (
                <dd className="mt-1.5 text-small wrap-break-word text-muted">{perk.details}</dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {benefits.length > 0 && (
        <>
          <h3 className="mt-5 text-lg">Your {levelTitle(level)} membership includes</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {benefits.map((benefit) => (
              <li key={benefit.key}>{benefit.text}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
