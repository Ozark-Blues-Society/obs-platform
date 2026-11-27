import { useId } from "react";
import { SponsorLogo } from "@/components/ui/sponsor-logo";
import type { SponsorTier, SponsorTierGroup } from "@/sanity/content/sponsors";
import { sponsorLogo } from "./sponsor-views";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** The line beside a tier's name: its price, if it has one, and what its sponsors get. */
export function tierDetails(tier: SponsorTier): string {
  const price = tier.pricePerYear ? `${dollars.format(tier.pricePerYear)} a year` : "";
  return [price, ...tier.benefits].filter(Boolean).join(" · ");
}

/**
 * The Sponsors page's sponsors, one group per tier in the tiers' order: the tier's name, its price
 * and benefits, then its sponsors as a large logo, a logo or the name, as the tier's logo
 * placement says, each linking to the sponsor's website.
 */
export function SponsorTiers({ groups }: { groups: readonly SponsorTierGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <TierGroup key={group.tier?.id ?? ""} {...group} />
      ))}
    </>
  );
}

function TierGroup({ tier, sponsors }: SponsorTierGroup) {
  const headingId = useId();
  const placement = tier?.logoPlacement ?? "logo";
  const details = tier && tierDetails(tier);
  return (
    <section aria-labelledby={headingId} className="mt-8 first:mt-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id={headingId} className="text-h3">
          {tier?.name ?? "Other sponsors"}
        </h2>
        {details && (
          <p className="text-small text-muted">
            <span aria-hidden="true">&mdash; </span>
            {details}
          </p>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-3.5">
        {sponsors.map((sponsor) => (
          <li key={sponsor.id}>
            <SponsorLogo
              name={sponsor.name}
              href={sponsor.website}
              logo={sponsorLogo(sponsor, placement)}
              placement={placement}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
