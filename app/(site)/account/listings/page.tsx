import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { LISTING_DAYS } from "@/lib/listings/listing-state";
import { listMyListings } from "@/lib/listings/my-listings";
import { removeListing, renewListing } from "@/lib/listings/my-listings-actions";
import {
  MY_LISTINGS_MESSAGES,
  RENEW_WITHIN_DAYS,
  listingStanding,
  type MyListing,
} from "@/lib/listings/my-listings-state";
import { getPoster, postingAccess, type Poster } from "@/lib/listings/poster";
import { ACCOUNT_PATH, JOIN_PATH, MY_LISTINGS_PATH, NEW_LISTING_PATH } from "@/lib/site/navigation";
import { MyListings } from "./my-listings";

export const metadata: Metadata = {
  title: "My listings · Ozark Blues Society",
};

// The member's own classifieds listings, whatever their status, with Renew and Remove (backlog K-4,
// board-decisions §7). Members-only, like all of /account (the proxy sends visitors to sign in).
// The 5-day reminder email links here with ?renew=<listing id>, and that listing comes first. The
// heading and intro are the static shell; the rest needs the member, so it streams in at request
// time.
export default function MyListingsPage({ searchParams }: PageProps<"/account/listings">) {
  return (
    <>
      <PageHeader
        title="My listings"
        intro={`Your classifieds listings and where each one stands. A listing runs for ${LISTING_DAYS} days from approval; from ${RENEW_WITHIN_DAYS} days before it comes down, you can renew it to keep it up.`}
      />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <div className="max-w-3xl">
          <p className="mt-8">
            <Link href={ACCOUNT_PATH} className="text-sm">
              Back to My Account
            </Link>
          </p>
          <Suspense fallback={<p className="mt-8 text-muted">Loading your listings…</p>}>
            <Listings searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function Listings({ searchParams }: Pick<PageProps<"/account/listings">, "searchParams">) {
  const user = await requireUser(MY_LISTINGS_PATH);
  const { renew } = await searchParams;
  let listings: MyListing[];
  let poster: Poster;
  try {
    [listings, poster] = await Promise.all([listMyListings(user.id), getPoster(user.id)]);
  } catch (error) {
    console.error("Loading My listings failed:", error);
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        Your listings can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }

  const now = new Date();
  const access = postingAccess(poster, now);
  return (
    <>
      {!access.allowed && (
        <div className="mt-8 rounded-lg border border-accent bg-accent-soft p-4 text-ink">
          <p>
            {access.reason === "renew" ? MY_LISTINGS_MESSAGES.renew : MY_LISTINGS_MESSAGES.join}
          </p>
          <p className="mt-3">
            <ButtonLink href={JOIN_PATH} size="sm">
              {access.reason === "renew" ? "Renew your membership" : "Join the Society"}
            </ButtonLink>
          </p>
        </div>
      )}
      <MyListings
        items={listings.map((listing) => ({ listing, standing: listingStanding(listing, now) }))}
        canRenew={access.allowed}
        highlight={typeof renew === "string" ? renew : null}
        renew={renewListing}
        remove={removeListing}
      />
      {access.allowed && (
        <p className="mt-8">
          <ButtonLink href={NEW_LISTING_PATH} variant="dark" size="sm">
            Post a listing
          </ButtonLink>
        </p>
      )}
    </>
  );
}
