import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { confirmSignIn } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/next-path";
import { FinishSignInForm } from "./finish-sign-in-form";

export const metadata: Metadata = {
  title: "Finish signing in · Ozark Blues Society",
};

// The sign-in email (supabase/templates/magic-link.html) links here with a one-time token hash.
// Opening this page doesn't use the token up; pressing its button does (confirmSignIn). Some mail
// systems open the links in incoming email to scan them before the member sees them (Microsoft
// Defender Safe Links, for example). They only load the page, so the link still works when the
// member opens it. Never submit the form from a script: scanners that run scripts would use the
// link up again.
export default function ConfirmSignInPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <>
      <PageHeader title="Finish signing in" />
      <div className="mx-auto w-full max-w-site px-gutter pb-12 sm:pb-16">
        <div className="max-w-md">
          <Suspense fallback={<p className="mt-8 text-muted">Loading…</p>}>
            <ConfirmForm searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function ConfirmForm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  if (typeof tokenHash !== "string" || tokenHash === "" || type !== "email") {
    // Not a sign-in link, or one that lost part of its address on the way.
    redirect("/sign-in?error=link-expired");
  }

  return (
    <FinishSignInForm action={confirmSignIn} tokenHash={tokenHash} next={safeNextPath(next)} />
  );
}
