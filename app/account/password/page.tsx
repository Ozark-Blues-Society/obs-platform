import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12 sm:py-16">
      <Link href="/account" className="text-sm">
        Back to My Account
      </Link>
      <h1 className="mt-4">Set or change your password</h1>
      <p className="mt-4 text-muted">
        With a password, you can sign in without waiting for an email. Sign-in links by email keep
        working too.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading the password form…</p>}>
        <PasswordForm />
      </Suspense>
    </main>
  );
}

async function PasswordForm() {
  const user = await requireUser("/account/password");
  return <SetPasswordForm action={setPassword} email={user.email ?? ""} />;
}
