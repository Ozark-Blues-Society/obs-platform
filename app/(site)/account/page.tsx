import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyAccount } from "@/lib/account/my-account";
import { saveProfile } from "@/lib/account/profile-actions";
import { profileValues } from "@/lib/account/profile-state";
import { signOut } from "@/lib/auth/actions";
import { membershipStanding } from "@/lib/members/membership";
import { NEW_LISTING_PATH } from "@/lib/site/navigation";
import { getMemberPerks } from "@/sanity/content/member-perks";
import { MembershipCard } from "./membership-card";
import { PerksCard } from "./perks-card";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "My Account · Ozark Blues Society",
};

// My Account (backlog M-8): the member's membership, their perks and their details. Members-only,
// like all of /account (the proxy sends visitors to sign in). The heading and intro are part of the
// static shell; the rest needs the member, so it streams in at request time.
//
// Email preferences wait on Q-20261127-174756-24341, and "My listings" arrives with the
// classifieds (K-4, Launch 2); the Customer Portal link is M-6.
export default function AccountPage() {
  return (
    <>
      <PageHeader
        title="My Account"
        intro="Your membership, member perks and details, all in one place."
      />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <Suspense fallback={<p className="mt-8 text-muted">Loading your account…</p>}>
          <AccountSections />
        </Suspense>
      </div>
    </>
  );
}

async function AccountSections() {
  const [account, perks] = await Promise.all([getMyAccount(), getMemberPerks()]);
  const membership = membershipStanding(account, new Date());

  return (
    <>
      <p className="mt-8 text-lg wrap-break-word">
        You&rsquo;re signed in as <strong>{account.email}</strong>.
      </p>
      <div className="mt-6 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
        <MembershipCard membership={membership} joinedAt={account.joinedAt} />
        <PerksCard membership={membership} perks={perks} />
        <Card as="section" aria-labelledby="details-heading" className="p-5.5">
          <p className="text-eyebrow text-accent-dark uppercase">Your info</p>
          <h2 id="details-heading" className="mt-1.5 text-h3">
            Your details
          </h2>
          <ProfileForm action={saveProfile} profile={profileValues(account)} />
          <p className="mt-2 border-t border-line pt-4 text-sm">
            <Link href="/account/password">Set or change your password</Link>
          </p>
        </Card>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ButtonLink href={NEW_LISTING_PATH} variant="dark" size="sm">
          Post a classifieds listing
        </ButtonLink>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
