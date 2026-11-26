// The site's menus (backlog D-2): the sections every visitor needs, from the approved concept
// (docs/design/prototype.html), plus the pages and links editors put in a menu in the Studio
// (a page's "Show in menu", and "Other menu links" in Site settings; see sanity/site-chrome.ts).
import { BLOG_PATH, EVENTS_PATH } from "@/sanity/paths";

export const SPONSORS_PATH = "/sponsors";
export const DONATE_PATH = "/donate";
/** Membership Benefits & Join (M-4). */
export const JOIN_PATH = "/join";
export const SIGN_IN_PATH = "/sign-in";
export const ACCOUNT_PATH = "/account";

export type NavLink = { label: string; href: string };

/** A menu item: a link, or a labeled group of links that opens from the header. */
export type NavItem =
  ({ kind: "link" } & NavLink) | { kind: "group"; label: string; links: NavLink[] };

/** The menus an editor can choose (MENU_PLACEMENTS in sanity/schemas/options.ts, minus "none"). */
export const MENU_PLACEMENTS = ["main", "events", "about", "member-resources", "footer"] as const;
export type MenuPlacement = (typeof MENU_PLACEMENTS)[number];

/** A page or link an editor put in a menu, in the order it appears there. */
export type MenuEntry = NavLink & { placement: MenuPlacement };

const link = (label: string, href: string): NavItem => ({ kind: "link", label, href });

/**
 * The header's menu. Events, Blog, Sponsors and Donate are always there. Editors' "Main menu"
 * entries follow Sponsors, and About and Member Resources appear once something is in them.
 * Events becomes a group, led by the calendar, when an editor puts a page under it.
 * Classifieds (Launch 2, decision 0002) joins after Blog when K-* builds /classifieds.
 */
export function buildMainNav(menu: readonly MenuEntry[]): NavItem[] {
  const entries = (placement: MenuPlacement): NavLink[] =>
    menu
      .filter((entry) => entry.placement === placement)
      .map(({ label, href }) => ({ label, href }));
  const group = (label: string, links: NavLink[]): NavItem[] =>
    links.length > 0 ? [{ kind: "group", label, links }] : [];

  const underEvents = entries("events");
  return [
    underEvents.length > 0
      ? {
          kind: "group",
          label: "Events",
          links: [{ label: "Events calendar", href: EVENTS_PATH }, ...underEvents],
        }
      : link("Events", EVENTS_PATH),
    link("Blog", BLOG_PATH),
    link("Sponsors", SPONSORS_PATH),
    ...entries("main").map((entry) => link(entry.label, entry.href)),
    ...group("About", entries("about")),
    ...group("Member Resources", entries("member-resources")),
    link("Donate", DONATE_PATH),
  ];
}

/** The footer's link columns. Editors' "Footer" entries follow Events and Blog under Explore. */
export function buildFooterNav(
  menu: readonly MenuEntry[],
): { heading: string; links: NavLink[] }[] {
  return [
    {
      heading: "Explore",
      links: [
        { label: "Events", href: EVENTS_PATH },
        { label: "Blog", href: BLOG_PATH },
        ...menu
          .filter((entry) => entry.placement === "footer")
          .map(({ label, href }) => ({ label, href })),
      ],
    },
    {
      heading: "Support",
      links: [
        { label: "Membership", href: JOIN_PATH },
        { label: "Donate", href: DONATE_PATH },
        { label: "Sponsor", href: SPONSORS_PATH },
      ],
    },
  ];
}

/** True when `href` is the page at `pathname`. */
export function isCurrentPage(href: string, pathname: string | null): boolean {
  return pathname !== null && href === pathname;
}

/** True when `pathname` is `href` or a page under it, such as a post under /blog. */
export function isInSection(href: string, pathname: string | null): boolean {
  if (pathname === null || !href.startsWith("/") || href === "/") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `value` if it's safe to put in a link: a path on this site (/events), an http(s) web address,
 * mailto: or tel:, the forms the Studio accepts (hrefRule in sanity/schemas/validation.ts).
 * Content can reach the dataset without the Studio's checks, so the site checks again. Anything
 * else, such as javascript: or //elsewhere.example, gives null.
 */
export function safeHref(value: string): string | null {
  const href = value.trim();
  if (/^\/(?![/\\])[^\s\\]*$/.test(href)) return href;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return href;
  if (/^tel:\+?[\d\s().-]{7,}$/i.test(href)) return telHref(href.slice("tel:".length));
  try {
    const url = new URL(href);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".")) {
      return url.href;
    }
  } catch {
    // Not a URL.
  }
  return null;
}

/** A tel: link for a phone number as people write it: "(479) 555-0100" → "tel:4795550100". */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return digits.replace("+", "").length >= 7 ? `tel:${digits}` : null;
}
