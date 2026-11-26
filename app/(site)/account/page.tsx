import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "My Account · Ozark Blues Society",
};

// A placeholder that proves the session works in Server Components. M-8 builds the real My Account
// page (membership status, renewal date, perks, profile and email preferences).
export default function AccountPage() {
  return (
    <>
      <PageHeader title="My Account" />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <div className="max-w-2xl">
          <Suspense fallback={<p className="mt-8 text-muted">Loading your account…</p>}>
            <AccountSummary />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function AccountSummary() {
  const user = await requireUser("/account");

  return (
    <>
      <p className="mt-8 text-lg">
        You&rsquo;re signed in as <strong>{user.email}</strong>.
      </p>
      <p className="mt-2 text-muted">Your membership details will appear here soon.</p>
      <p className="mt-6">
        <Link href="/account/password">Set or change your password</Link>
      </p>
      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="rounded-full border-2 border-ink px-5 py-2 font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Sign out
        </button>
      </form>
    </>
  );
}
