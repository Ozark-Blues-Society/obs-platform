import type { Metadata } from "next";
import { Suspense } from "react";
import { sendSignInLink, signInWithPassword } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/next-path";
import { MESSAGES } from "@/lib/auth/sign-in-state";
import { EmailLinkForm, PasswordForm } from "./sign-in-forms";

export const metadata: Metadata = {
  title: "Sign in · Ozark Blues Society",
};

// The heading and intro are part of the static shell. The forms read the URL (where to go after
// signing in, and whether a sign-in link failed), so they stream in at request time.
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12 sm:py-16">
      <p className="text-eyebrow text-accent-dark uppercase">Ozark Blues Society</p>
      <h1 className="mt-2">Member sign in</h1>
      <Suspense fallback={<p className="mt-8 text-muted">Loading the sign-in form…</p>}>
        <SignInForms searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInForms({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { next, error } = await searchParams;
  const linkFailed = error === "link-expired";

  return (
    <>
      {linkFailed && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-danger bg-danger-soft p-4 text-sm text-ink"
        >
          {MESSAGES.linkExpired}
        </p>
      )}

      <section id="email-link" aria-labelledby="email-link-heading" className="mt-8">
        <h2 id="email-link-heading" className="text-h3">
          Email me a sign-in link
        </h2>
        <p className="mt-1 text-muted">
          No password to remember. We&rsquo;ll email you a link that signs you in with one click.
        </p>
        <EmailLinkForm action={sendSignInLink} />
      </section>

      <section aria-labelledby="password-heading" className="mt-10 border-t border-line pt-8">
        <h2 id="password-heading" className="text-h3">
          Sign in with a password
        </h2>
        <PasswordForm action={signInWithPassword} next={safeNextPath(next)} />
        {/* Members who join online or are imported have no password until they set one. */}
        <p className="mt-4 text-sm text-muted">
          Forgot your password, or never set one?{" "}
          <a href="#email-link">Email yourself a sign-in link</a>, then set a new password on My
          Account.
        </p>
      </section>
    </>
  );
}
