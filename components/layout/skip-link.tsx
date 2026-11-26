/** The id of the site layout's <main>, where the skip link goes. */
export const MAIN_CONTENT_ID = "main-content";

/** The first stop for keyboard users: it skips the header and goes straight to the page. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="fixed top-3 left-3 z-50 -translate-y-[200%] rounded-full bg-accent px-4 py-2 font-semibold text-primary-dark no-underline focus:translate-y-0"
    >
      Skip to main content
    </a>
  );
}
