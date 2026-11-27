import type { ReactNode } from "react";
import { SanityImage } from "@/components/blocks/sanity-image";
import type { FeaturedSponsor } from "@/components/home/sponsor-band";
import type { CurrentSponsor, LogoPlacement } from "@/sanity/content/sponsors";

// How the Sponsors page and the home page show a sponsor from the Studio (backlog P-4).

// A logo is at most 40px high, or 56px for a tier with large logos (SponsorLogo), and never wider
// than the screen: a long wordmark shrinks to fit a phone instead of making the page scroll sideways.
const LOGO_CLASSES: Record<Exclude<LogoPlacement, "name">, string> = {
  large: "h-14 w-auto max-w-full object-contain",
  logo: "h-10 w-auto max-w-full object-contain",
};

/** The sponsor's logo in a list of sponsors, or undefined to show its name instead. */
export function sponsorLogo(
  sponsor: CurrentSponsor,
  placement: LogoPlacement = "logo",
): ReactNode | undefined {
  if (!sponsor.logo || placement === "name") return undefined;
  return (
    <SanityImage
      photo={sponsor.logo}
      sizes={placement === "large" ? "14rem" : "10rem"}
      className={LOGO_CLASSES[placement]}
    />
  );
}

/**
 * The featured sponsor's spotlight (SponsorSpotlight's props). The logo sits on white, as in the
 * lists of sponsors, so a dark logo still shows on the spotlight's dark panel, and so does its alt
 * text if the image can't load.
 */
export function featuredSponsorProps(sponsor: CurrentSponsor): FeaturedSponsor {
  return {
    name: sponsor.name,
    href: sponsor.website,
    blurb: sponsor.blurb,
    logo: sponsor.logo && (
      <span className="inline-flex max-w-full rounded-lg bg-white p-4 text-muted">
        <SanityImage
          photo={sponsor.logo}
          sizes="16rem"
          className="h-16 w-auto max-w-full object-contain"
        />
      </span>
    ),
  };
}
