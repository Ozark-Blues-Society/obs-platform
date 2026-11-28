import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ClassifiedsList } from "@/components/classifieds/classifieds-list";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/lib/auth/user";
import type { ListingCategory } from "@/lib/listings/listing-state";
import { listLiveListings } from "@/lib/listings/public";
import {
  classifiedsCategory,
  classifiedsTitle,
  type PublicListing,
} from "@/lib/listings/public-state";

// The musician classifieds (backlog K-3): the live listings, newest first, filtered by category
// with ?category=. Viewing is public; posting needs an active membership (board-decisions §7).
// The listings and the viewer are read at request time, below the page header.

export async function generateMetadata({
  searchParams,
}: PageProps<"/classifieds">): Promise<Metadata> {
  const query = await searchParams;
  return { title: classifiedsTitle(classifiedsCategory(query.category)) };
}

export default function ClassifiedsPage({ searchParams }: PageProps<"/classifieds">) {
  return (
    <>
      <PageHeader
        title="Musician Classifieds"
        intro="Find bandmates, gear, merch and a hand with the next show. Free for members, reviewed before posting."
      />
      <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Listings({ searchParams }: Pick<PageProps<"/classifieds">, "searchParams">) {
  const query = await searchParams;
  const category = classifiedsCategory(query.category);
  const [user, listings] = await Promise.all([getCurrentUser(), loadListings(category)]);
  if (listings === "unavailable") {
    return (
      <div className="mx-auto w-full max-w-site px-gutter py-10">
        <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-4">
          The listings can&rsquo;t be shown right now. Please try again in a few minutes.
        </p>
      </div>
    );
  }
  return <ClassifiedsList listings={listings} category={category} signedIn={user !== null} />;
}

async function loadListings(
  category: ListingCategory | null,
): Promise<PublicListing[] | "unavailable"> {
  try {
    return await listLiveListings(category);
  } catch (error) {
    // Next.js's own signals (the request's prerender ending while the read waits) aren't failures.
    unstable_rethrow(error);
    console.error("Loading the classifieds failed:", error);
    return "unavailable";
  }
}
