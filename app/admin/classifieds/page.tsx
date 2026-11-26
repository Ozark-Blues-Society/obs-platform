import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/user";
import { LISTING_DAYS } from "@/lib/listings/listing-state";
import { listPendingListings, moderatesListings } from "@/lib/listings/moderation";
import { approveListing, rejectListing } from "@/lib/listings/moderation-actions";
import { MODERATION_PATH, type PendingListing } from "@/lib/listings/moderation-state";
import { ACCOUNT_PATH } from "@/lib/site/navigation";
import { ModerationQueue } from "./moderation-queue";

export const metadata: Metadata = {
  title: "Classifieds moderation · Ozark Blues Society",
};

// Moderators and administrators (backlog A-3 and K-2; board-decisions §7). The proxy sends visitors
// to sign in. This page checks the role, and so does each Server Function
// (lib/listings/moderation-actions.ts); row level security enforces it in the database. The heading
// and intro are the static shell; the rest needs the member, so it streams in at request time.
export default function ModerationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-12">
      <h1>Classifieds moderation</h1>
      <p className="mt-4 text-muted">
        New listings wait here until a moderator approves them. An approved listing goes on the
        classifieds for {LISTING_DAYS} days; a rejected one stays off. Either way, the poster gets
        an email.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading listings…</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  const user = await requireUser(MODERATION_PATH);
  const listings = await loadQueue(user.id);

  if (listings === "not-moderator") {
    return (
      <p className="mt-8">
        Only moderators and administrators can review classified listings. If you need to, ask an
        administrator for the Moderator role. <Link href={ACCOUNT_PATH}>Back to My Account</Link>
      </p>
    );
  }
  if (listings === "unavailable") {
    return (
      <p role="alert" className="mt-8 rounded-lg border border-danger bg-danger-soft p-4">
        The listings can&rsquo;t be shown right now. Please try again in a few minutes.
      </p>
    );
  }
  return <ModerationQueue listings={listings} approve={approveListing} reject={rejectListing} />;
}

async function loadQueue(
  userId: string,
): Promise<PendingListing[] | "not-moderator" | "unavailable"> {
  try {
    if (!(await moderatesListings(userId))) return "not-moderator";
    return await listPendingListings();
  } catch (error) {
    console.error("Loading the moderation queue failed:", error);
    return "unavailable";
  }
}
