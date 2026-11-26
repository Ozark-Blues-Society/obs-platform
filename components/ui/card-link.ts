/**
 * Classes for the title link of a clickable card (event and post cards). The link's ::after covers
 * the whole card (which must be `relative`), so a click anywhere on the card follows the link, and
 * the focus outline goes around the card instead of the title.
 */
export const cardLinkClasses =
  "text-ink no-underline after:absolute after:inset-0 after:rounded-card hover:underline " +
  "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 " +
  "focus-visible:after:outline-focus";
