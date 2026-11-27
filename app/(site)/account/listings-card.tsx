import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  STANDING_TONES,
  standingSummary,
  type ListingStanding,
  type MyListing,
} from "@/lib/listings/my-listings-state";
import { MY_LISTINGS_PATH } from "@/lib/site/navigation";

/**
 * My Account's summary of the member's classifieds listings and where each stands (backlog K-4,
 * the concept's "My classifieds"), with a link to My listings, where they renew or remove them.
 */
export function ListingsCard({
  items,
}: {
  items: { listing: MyListing; standing: ListingStanding }[];
}) {
  return (
    <Card as="section" aria-labelledby="listings-heading" className="mt-8 p-5.5">
      <p className="text-eyebrow text-accent-dark uppercase">Classifieds</p>
      <h2 id="listings-heading" className="mt-1.5 text-h3">
        My listings
      </h2>
      {items.length === 0 ? (
        <p className="mt-3">You haven&rsquo;t posted any listings yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map(({ listing, standing }) => (
            <li
              key={listing.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <span className="wrap-anywhere">{listing.title}</span>
              <Tag tone={STANDING_TONES[standing.kind]}>{standingSummary(standing)}</Tag>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-line pt-4 text-sm">
        <Link href={MY_LISTINGS_PATH}>
          {items.length === 0 ? "Go to My listings" : "Renew or remove your listings"}
        </Link>
      </p>
    </Card>
  );
}
