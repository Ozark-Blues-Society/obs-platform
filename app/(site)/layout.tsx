import { draftMode } from "next/headers";
import { Suspense } from "react";
import { AccountLinks, AccountLinksPlaceholder } from "@/components/layout/account-links";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { WithSiteChrome } from "@/components/layout/with-site-chrome";
import { buildFooterNav, buildMainNav } from "@/lib/site/navigation";
import { isConfigured } from "@/sanity/env";
import { SanityLive } from "@/sanity/live";
import { PreviewBanner } from "./draft-mode/preview-banner";
import { PreviewVisualEditing } from "./draft-mode/visual-editing";

// Layout for the public site and the member pages: the header, the page's <main> and the footer
// (backlog D-2). The Studio (app/studio) sits outside this group, so none of this renders inside
// it. Pages render their content without a <main> of their own.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Draft mode is on only for live preview in the Studio and for shared preview links.
  const { isEnabled: isDraftMode } = await draftMode();
  const account = (
    <Suspense fallback={<AccountLinksPlaceholder />}>
      <AccountLinks />
    </Suspense>
  );

  return (
    <>
      <SkipLink />
      {isDraftMode && <PreviewBanner />}
      <WithSiteChrome
        isDraftMode={isDraftMode}
        render={({ menu }) => <SiteHeader items={buildMainNav(menu)} account={account} />}
      />
      {/* tabIndex lets the skip link move focus here, so the next Tab starts in the page. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <WithSiteChrome
        isDraftMode={isDraftMode}
        render={({ menu, footer }) => (
          <SiteFooter columns={buildFooterNav(menu)} settings={footer} />
        )}
      />
      {/* Keeps cached Sanity content fresh when editors publish. Needs a real project. */}
      {isConfigured && <SanityLive includeDrafts={isDraftMode} />}
      {isDraftMode && <PreviewVisualEditing />}
    </>
  );
}
