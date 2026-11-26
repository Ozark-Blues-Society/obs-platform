import { Suspense, type ReactNode } from "react";
import { getDynamicFetchOptions, type DynamicFetchOptions } from "@/sanity/live";
import { EMPTY_SITE_CHROME, getSiteChrome, type SiteChrome } from "@/sanity/site-chrome";

type Render = (chrome: SiteChrome) => ReactNode;

const PUBLISHED: DynamicFetchOptions = { perspective: "published", stega: false };

/**
 * Renders `render` with the menus and footer settings from the Studio (Sanity's three-layer
 * pattern for Cache Components). Published content is cached into each page's prerendered shell.
 * In draft mode (live preview, or a shared preview link) the drafts load per request, and the
 * built-in links show until they arrive.
 */
export function WithSiteChrome({ isDraftMode, render }: { isDraftMode: boolean; render: Render }) {
  if (!isDraftMode) {
    return <CachedChrome options={PUBLISHED} render={render} />;
  }
  return (
    <Suspense fallback={render(EMPTY_SITE_CHROME)}>
      <DraftChrome render={render} />
    </Suspense>
  );
}

async function DraftChrome({ render }: { render: Render }) {
  return <CachedChrome options={await getDynamicFetchOptions()} render={render} />;
}

async function CachedChrome({ options, render }: { options: DynamicFetchOptions; render: Render }) {
  return render(await getSiteChrome(options));
}
