import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { setPassword } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/user";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Your password · Ozark Blues Society",
};

// Members-only, like all of /account (the proxy sends visitors to sign in). The heading and intro
// are part of the static shell; the form needs the member, so it streams in at request time.
export default function PasswordPage() {
  return (
    <>
      <PageHeader
        title="Set or change your password"
        intro="With a password, you can sign in without waiting for an email. Sign-in links by email keep working too."
      />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <div className="max-w-md">
          <p className="mt-8">
            <Link href="/account" className="text-sm">
              Back to My Account
            </Link>
          </p>
          <Suspense fallback={<p className="mt-8 text-muted">Loading the password form…</p>}>
            <PasswordForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function PasswordForm() {
  const user = await requireUser("/account/password");
  return <SetPasswordForm action={setPassword} email={user.email ?? ""} />;
}
