import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BecomeASponsor } from "@/components/sponsors/become-a-sponsor";
import { CurrentSponsorsByTier } from "@/components/sponsors/current-sponsors-by-tier";

// The Sponsors page (backlog P-4): the featured sponsor's spotlight, every current sponsor grouped
// by tier, and how to become a sponsor. Tiers, with their order, prices, benefits and logo
// placements, are data in the Studio, so the board can add tiers without code changes (board
// decisions §8). A sponsor disappears by itself the day after its sponsorship ends.
//
// Sponsors are public. Reading them checks today's date and whether this is a preview, so the
// sponsors render at request time, below the page header.

export const metadata: Metadata = { title: "Sponsors · Ozark Blues Society" };

export default function SponsorsPage() {
  return (
    <>
      <PageHeader title="Our Sponsors" intro="The businesses that keep the music playing." />
      <div className="mx-auto w-full max-w-site px-gutter pt-8 pb-section">
        <Suspense fallback={<p>Loading…</p>}>
          <CurrentSponsorsByTier />
        </Suspense>
        <BecomeASponsor className="mt-9" />
      </div>
    </>
  );
}
