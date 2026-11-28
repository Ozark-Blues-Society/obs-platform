import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cardLinkClasses } from "@/components/ui/card-link";
import { Tag } from "@/components/ui/tag";
import { categoryTitle, formatPrice } from "@/lib/listings/moderation-state";
import { categoryTone, listingPath, type PublicListing } from "@/lib/listings/public-state";

/**
 * A live listing on the classifieds (backlog K-3), as in the approved concept: its category, title
 * and price, the start of the details, who posted it, and Contact. The whole card links to the
 * listing's page; Contact goes straight to the form there.
 *
 * Members write titles and details, and a long web address is common in classifieds, so both wrap
 * anywhere rather than widen the page.
 */
export function ListingCard({ listing }: { listing: PublicListing }) {
  const { id, title, price, poster } = listing;
  const href = listingPath(id);
  return (
    <Card as="article" className="relative flex h-full flex-col p-4.5">
      <p>
        <Tag tone={categoryTone(listing.category)}>{categoryTitle(listing.category)}</Tag>
      </p>
      <h2 className="mt-2 text-h3 wrap-break-word">
        <Link href={href} className={cardLinkClasses}>
          {title}
          {price !== null && ` — ${formatPrice(price)}`}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 text-small wrap-break-word">{listing.body}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
        <span className="text-small text-muted">Posted by {poster ?? "a member"}</span>
        {/* Above the card's link, which covers the rest of the card. */}
        <ButtonLink
          href={`${href}#contact`}
          variant="dark"
          size="sm"
          className="relative z-10"
          aria-label={`Contact ${poster ?? "the poster"} about “${title}”`}
        >
          Contact
        </ButtonLink>
      </div>
    </Card>
  );
}
