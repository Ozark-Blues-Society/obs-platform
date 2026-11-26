import Link from "next/link";
import { useId, type ReactNode } from "react";
import { SponsorLogo } from "@/components/ui/sponsor-logo";
import { SponsorSpotlight } from "@/components/ui/sponsor-spotlight";
import { SPONSORS_PATH } from "@/lib/site/navigation";

export type BandSponsor = {
  name: string;
  /** The sponsor's website. */
  href?: string;
  /** The logo image, with the sponsor's name as its alt text. */
  logo?: ReactNode;
};

export type FeaturedSponsor = BandSponsor & { blurb?: string };

type SponsorBandProps = {
  /** The featured sponsor's spotlight, above the logos. */
  featured?: FeaturedSponsor;
  /** The current sponsors (past their end date they're left out). */
  sponsors: readonly BandSponsor[];
};

/** The home page's sponsors: the featured sponsor's spotlight, every sponsor's logo, and a link. */
export function SponsorBand({ featured, sponsors }: SponsorBandProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-y border-line bg-surface py-10">
      <div className="mx-auto max-w-site px-gutter">
        <div className="text-center">
          <p className="text-eyebrow text-accent-dark uppercase">Made possible by</p>
          <h2 id={headingId} className="text-h3">
            Our sponsors
          </h2>
        </div>
        {featured && (
          <SponsorSpotlight
            name={featured.name}
            href={featured.href}
            blurb={featured.blurb}
            logo={featured.logo}
            headingLevel={3}
            className="mt-6"
          />
        )}
        {sponsors.length > 0 && (
          <ul className="mt-6 flex flex-wrap justify-center gap-3.5">
            {sponsors.map((sponsor) => (
              <li key={sponsor.name}>
                <SponsorLogo name={sponsor.name} href={sponsor.href} logo={sponsor.logo} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4.5 text-center">
          <Link href={SPONSORS_PATH}>
            Become a sponsor <span aria-hidden="true">&rarr;</span>
          </Link>
        </p>
      </div>
    </section>
  );
}
