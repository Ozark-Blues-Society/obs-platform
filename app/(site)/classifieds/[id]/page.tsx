import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { cache, Suspense } from "react";
import { ListingView } from "@/components/classifieds/listing-view";
import { PageHeader } from "@/components/layout/page-header";
import { contactFormAction } from "@/lib/listings/contact";
import { getLiveListing } from "@/lib/listings/public";
import type { ListingDetail } from "@/lib/listings/public-state";

// A classifieds listing's own page (backlog K-3): public while the listing is live, with a way to
// reach the poster. Anything else at this address (a pending, rejected or expired listing, or no
// listing at all) is a page not found, for everyone: posters follow their own listings in My
// Account, moderators in the moderation queue. It reads the viewer, so it renders at request time.

// One read per request, shared by the metadata and the page. Null when there's no live listing; a
// listing that can't be read at all shows a message instead.
const loadListing = cache(async (id: string): Promise<ListingDetail | null | "unavailable"> => {
  try {
    return await getLiveListing(id);
  } catch (error) {
    // Next.js's own signals (the request's prerender ending while the read waits) aren't failures.
    unstable_rethrow(error);
    console.error("Loading a classifieds listing failed:", error);
    return "unavailable";
  }
});

export async function generateMetadata({
  params,
}: PageProps<"/classifieds/[id]">): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  const title = listing && listing !== "unavailable" ? listing.title : "";
  return { title: [title, "Classifieds", "Ozark Blues Society"].filter(Boolean).join(" · ") };
}

export default function ListingPage({ params }: PageProps<"/classifieds/[id]">) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-site px-gutter py-10">Loading…</p>}>
      <Listing params={params} />
    </Suspense>
  );
}

async function Listing({ params }: Pick<PageProps<"/classifieds/[id]">, "params">) {
  const listing = await loadListing((await params).id);
  if (listing === "unavailable") {
    return (
      <>
        <PageHeader title="Musician Classifieds" />
        <div className="mx-auto w-full max-w-site px-gutter py-10">
          <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-4">
            This listing can&rsquo;t be shown right now. Please try again in a few minutes.
          </p>
        </div>
      </>
    );
  }
  if (!listing) notFound();

  // The contact form's Server Function, sealed with this listing and this moment (decision 0009).
  return <ListingView listing={listing} contact={contactFormAction(listing.id)} />;
}
