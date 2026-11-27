import { listCurrentSponsors } from "@/sanity/content/sponsors";
import { SponsorStripBlock } from "./list-blocks";
import { SanityImage } from "./sanity-image";

/**
 * A page's "Sponsor logos" block, filled from the Studio: the sponsors the editor picked, or every
 * current sponsor, each linking to its website. A sponsor without a logo shows its name. Draws
 * nothing when no sponsor is current. It reads the request, so render it inside `<Suspense>`.
 */
export async function CurrentSponsors({
  heading,
  sponsorIds,
}: {
  heading: string;
  /** The sponsors the editor picked, or none for all of them. */
  sponsorIds: readonly string[];
}) {
  const sponsors = await listCurrentSponsors(sponsorIds);
  return (
    <SponsorStripBlock
      heading={heading}
      sponsors={sponsors.map((sponsor) => ({
        name: sponsor.name,
        href: sponsor.website,
        logo: sponsor.logo && (
          <SanityImage photo={sponsor.logo} sizes="10rem" className="h-10 w-auto" />
        ),
      }))}
    />
  );
}
