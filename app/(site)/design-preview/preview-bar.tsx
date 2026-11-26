import Link from "next/link";
import { cx } from "@/lib/cx";
import {
  DIRECTORY_VIEWS,
  PREVIEW_PAGES,
  type DirectoryView,
  type PreviewPage,
} from "./sample-content";

// On accent-soft the usual focus color is too faint, so links here use navy (tokens.md).
const LINK = "text-ink focus-visible:outline-primary-dark";
const CURRENT = "font-semibold no-underline";

type PreviewBarProps = {
  current: PreviewPage;
  /** On the Directory pages: whose view of the page this is. */
  directoryView?: DirectoryView;
};

/**
 * The strip at the top of every design preview page: what this is, and links to the other pages
 * of the package. It isn't part of the site's design.
 */
export function PreviewBar({ current, directoryView }: PreviewBarProps) {
  return (
    <nav aria-label="Design preview" className="bg-accent-soft text-sm text-ink">
      <div className="mx-auto max-w-site px-gutter py-2.5">
        <p>
          <strong>Design preview with sample content.</strong> The logo, colors and photos are
          placeholders until the Society sends its own.
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(PREVIEW_PAGES) as PreviewPage[]).map((page) => (
            <li key={page}>
              <Link
                href={PREVIEW_PAGES[page].href}
                aria-current={page === current ? currentKind(directoryView) : undefined}
                className={cx(LINK, page === current && CURRENT)}
              >
                {PREVIEW_PAGES[page].label}
              </Link>
            </li>
          ))}
        </ul>
        {directoryView && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <span id="directory-views">View the Directory as:</span>
            <ul aria-labelledby="directory-views" className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(DIRECTORY_VIEWS) as DirectoryView[]).map((view) => (
                <li key={view}>
                  <Link
                    href={DIRECTORY_VIEWS[view].href}
                    aria-current={view === directoryView ? "page" : undefined}
                    className={cx(LINK, view === directoryView && CURRENT)}
                  >
                    {DIRECTORY_VIEWS[view].label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

// The Directory link leads to the members' view: on the other two views it marks the section the
// page is in rather than the page itself.
function currentKind(directoryView: DirectoryView | undefined): "page" | "true" {
  return directoryView && directoryView !== "contacts" ? "true" : "page";
}
