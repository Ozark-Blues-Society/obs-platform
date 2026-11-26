import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { preparePhotoUpload, submitListing } from "@/lib/listings/listing-actions";
import { LISTING_DAYS } from "@/lib/listings/listing-state";
import { getPoster, postingAccess, type Poster } from "@/lib/listings/poster";
import { ACCOUNT_PATH, JOIN_PATH, NEW_LISTING_PATH } from "@/lib/site/navigation";
import { formatSocietyDate } from "@/lib/society-time";
import { ListingForm } from "./listing-form";

export const metadata: Metadata = {
  title: "Post a listing · Ozark Blues Society",
};

// Active members, at any level, post classifieds listings (backlog K-1, board-decisions §7).
// Members-only, like all of /account (the proxy sends visitors to sign in). This page checks the
// membership, and so does each Server Function (lib/listings/listing-actions.ts); row level
// security and the Storage policies enforce it too. The heading and intro are the static shell;
// the rest needs the member, so it streams in at request time.
export default function NewListingPage() {
  return (
    <>
      <PageHeader
        title="Post a listing"
        intro={`Find bandmates, gigs and gear buyers. Free for members: a moderator reviews each listing before it goes live, and it runs for ${LISTING_DAYS} days.`}
      />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <div className="max-w-2xl">
          <p className="mt-8">
            <Link href={ACCOUNT_PATH} className="text-sm">
              Back to My Account
            </Link>
          </p>
          <Suspense fallback={<p className="mt-8 text-muted">Loading the form…</p>}>
            <NewListing />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function NewListing() {
  const user = await requireUser(NEW_LISTING_PATH);
  let poster: Poster;
  try {
    poster = await getPoster(user.id);
  } catch (error) {
    console.error("Loading the member for a new listing failed:", error);
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        The form can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }

  const access = postingAccess(poster, new Date());
  if (!access.allowed) {
    return (
      <div className="mt-8">
        {access.reason === "renew" && poster.expiresAt ? (
          <p>
            Your membership ended on {formatSocietyDate(poster.expiresAt)}. Renew it to post a
            listing: posting is open to every member whose membership is current.
          </p>
        ) : (
          <p>
            Posting in the classifieds is a member benefit, at every membership level. Join the
            Society to post a listing.
          </p>
        )}
        <p className="mt-6">
          <ButtonLink href={JOIN_PATH}>
            {access.reason === "renew" ? "Renew your membership" : "Join the Society"}
          </ButtonLink>
        </p>
      </div>
    );
  }

  return <ListingForm prepare={preparePhotoUpload} submit={submitListing} phone={poster.phone} />;
}
