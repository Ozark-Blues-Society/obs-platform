import { featuredSponsorProps, sponsorLogo } from "@/components/sponsors/sponsor-views";
import { listCurrentSponsors, pickFeaturedSponsor } from "@/sanity/content/sponsors";
import { SponsorBand } from "./sponsor-band";

/**
 * The home page's sponsors, from the Studio: the featured sponsor's spotlight (the same one the
 * Sponsors page shows) and every current sponsor's logo, or its name until it has one. Draws
 * nothing while no sponsor is current. It reads the request, so render it inside `<Suspense>`.
 */
export async function HomeSponsors() {
  const sponsors = await listCurrentSponsors([]);
  if (sponsors.length === 0) return null;
  const featured = pickFeaturedSponsor(sponsors);
  return (
    <SponsorBand
      featured={featured && featuredSponsorProps(featured)}
      sponsors={sponsors.map((sponsor) => ({
        name: sponsor.name,
        href: sponsor.website,
        logo: sponsorLogo(sponsor),
      }))}
    />
  );
}
