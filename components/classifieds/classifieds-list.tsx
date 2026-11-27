import Link from "next/link";
import { CardGrid } from "@/components/ui/card-grid";
import { PillLinks } from "@/components/ui/pill-links";
import { LISTING_CATEGORIES, type ListingCategory } from "@/lib/listings/listing-state";
import { classifiedsHref, listingsSummary, type PublicListing } from "@/lib/listings/public-state";
import { ListingCard } from "./listing-card";
import { PostListingLink } from "./post-listing-link";

type ClassifiedsListProps = {
  /** The live listings of the category picked, newest first. */
  listings: readonly PublicListing[];
  /** The category picked, or null for every listing. */
  category: ListingCategory | null;
  /** Whether someone is signed in: a visitor's "Post a listing" asks them to sign in or join. */
  signedIn: boolean;
};

/**
 * The classifieds (backlog K-3): the category pills and "Post a listing", then the live listings'
 * cards. Each category has its own web address (?category=), so a filter works without
 * JavaScript and can be shared.
 */
export function ClassifiedsList({ listings, category, signedIn }: ClassifiedsListProps) {
  return (
    <div className="mx-auto w-full max-w-site px-gutter pt-7 pb-10 md:pb-section">
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <PillLinks
          label="Classifieds categories"
          links={[
            { label: "All", href: classifiedsHref(null), current: category === null },
            ...LISTING_CATEGORIES.map((option) => ({
              label: option.title,
              href: classifiedsHref(option.value),
              current: option.value === category,
            })),
          ]}
        />
        <PostListingLink signedIn={signedIn} />
      </div>
      {/*
        A polite live region: following a pill keeps this element and changes its text, so screen
        readers say what the new list holds. (Next.js's route announcer reads only the page's
        heading.) With no listings, everyone sees it.
      */}
      <p role="status" className={listings.length === 0 ? "text-muted" : "sr-only"}>
        {listingsSummary(listings.length, category)}
        {listings.length === 0 && category && (
          <>
            {" "}
            <Link href={classifiedsHref(null)}>See all listings</Link>
          </>
        )}
      </p>
      {listings.length > 0 && (
        <CardGrid>
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </CardGrid>
      )}
    </div>
  );
}
