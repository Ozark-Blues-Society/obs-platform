import { SponsorSpotlight } from "@/components/ui/sponsor-spotlight";
import {
  groupSponsorsByTier,
  listCurrentSponsors,
  pickFeaturedSponsor,
} from "@/sanity/content/sponsors";
import { SponsorTiers } from "./sponsor-tiers";
import { featuredSponsorProps } from "./sponsor-views";

/**
 * The Sponsors page's sponsors, from the Studio: the featured sponsor's spotlight, then every
 * current sponsor grouped by tier. A sponsor disappears by itself the day after its sponsorship
 * ends. It reads the request, so render it inside `<Suspense>`.
 */
export async function CurrentSponsorsByTier() {
  const sponsors = await listCurrentSponsors([]);
  if (sponsors.length === 0) {
    return <p className="text-muted">No sponsors are listed right now.</p>;
  }
  const featured = pickFeaturedSponsor(sponsors);
  return (
    <>
      {featured && <SponsorSpotlight {...featuredSponsorProps(featured)} />}
      <SponsorTiers groups={groupSponsorsByTier(sponsors)} />
    </>
  );
}
