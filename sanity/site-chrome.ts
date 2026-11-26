// What the header and footer (components/layout/) show from the Studio: the pages and links editors
// put in a menu, and the footer's Site settings. Every page renders them, so this is cached, and
// Sanity Live (app/(site)/layout.tsx) refreshes the cache when an editor publishes.
import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { defineQuery, stegaClean } from "next-sanity";
import {
  MENU_PLACEMENTS,
  safeHref,
  telHref,
  type MenuEntry,
  type MenuPlacement,
  type NavLink,
} from "@/lib/site/navigation";
import { isConfigured } from "./env";
import { sanityFetch, type DynamicFetchOptions } from "./live";
import { pagePath } from "./paths";
import { SOCIAL_PLATFORMS } from "./schemas/options";

export type FooterSettings = {
  /** Site settings' "About the Society" sentence. */
  about?: string;
  mailingAddress?: string;
  email?: { text: string; href: string };
  phone?: { text: string; href: string };
  socialLinks: NavLink[];
};

export type SiteChrome = { menu: MenuEntry[]; footer: FooterSettings };

/** What the header and footer show with nothing from the Studio: the built-in parts only. */
export const EMPTY_SITE_CHROME: SiteChrome = { menu: [], footer: { socialLinks: [] } };

export const SITE_CHROME_QUERY = defineQuery(`{
  "pages": *[_type == "page" && defined(slug.current) && menuPlacement in $placements]{
    title, "slug": slug.current, menuPlacement, menuOrder
  },
  "settings": *[_id == "siteSettings"][0]{
    footerText, mailingAddress, email, phone,
    socialLinks[]{ platform, url },
    menuLinks[]{ label, href, placement }
  }
}`);

/**
 * The menus and footer settings for this perspective (published content, or drafts in a
 * preview). With no Sanity project yet, or if Sanity can't be reached, the header and footer
 * still render, with their built-in links, and a failed load is retried within minutes.
 */
export async function getSiteChrome({ perspective, stega }: DynamicFetchOptions) {
  "use cache";
  if (!isConfigured) return EMPTY_SITE_CHROME;
  try {
    const { data } = await sanityFetch({
      query: SITE_CHROME_QUERY,
      params: { placements: [...MENU_PLACEMENTS] },
      perspective,
      stega,
    });
    return parseSiteChrome(data);
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Loading the menus and footer from Sanity failed; showing the built-in ones.",
      error,
    );
    cacheLife("minutes");
    return EMPTY_SITE_CHROME;
  }
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const list = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.flatMap((item: unknown): Fields[] => {
        const found = fields(item);
        return found ? [found] : [];
      })
    : [];

// In a preview, strings carry invisible edit markers (stega) that let editors click text to edit
// it. Text people read keeps them; values the site acts on (links, menu choices) are cleaned.
const text = (value: unknown): string | undefined =>
  typeof value === "string" && stegaClean(value).trim() !== "" ? value : undefined;
const plain = (value: unknown): string =>
  typeof value === "string" ? stegaClean(value).trim() : "";

const isPlacement = (value: string): value is MenuPlacement =>
  (MENU_PLACEMENTS as readonly string[]).includes(value);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turns the query result into menu entries and footer settings, skipping anything incomplete or
 * unsafe. In each menu, pages come first, by "Position in menu" (lowest first, pages without one
 * last) and then by title; "Other menu links" from Site settings follow in their own order.
 */
export function parseSiteChrome(data: unknown): SiteChrome {
  const result = fields(data);

  const pages = list(result?.pages).flatMap((page) => {
    const label = text(page.title);
    const slug = plain(page.slug);
    const placement = plain(page.menuPlacement);
    if (!label || !SLUG.test(slug) || !isPlacement(placement)) return [];
    const position =
      typeof page.menuOrder === "number" && Number.isFinite(page.menuOrder)
        ? page.menuOrder
        : Number.POSITIVE_INFINITY;
    return [{ entry: { label, href: pagePath(slug), placement }, position, title: plain(label) }];
  });
  pages.sort(
    (a, b) =>
      a.position - b.position ||
      a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true }),
  );

  const settings = fields(result?.settings);
  const links = list(settings?.menuLinks).flatMap((item): MenuEntry[] => {
    const label = text(item.label);
    const href = safeHref(plain(item.href));
    const placement = plain(item.placement);
    return label && href && isPlacement(placement) ? [{ label, href, placement }] : [];
  });

  const email = plain(settings?.email);
  const emailText = text(settings?.email);
  const phoneText = text(settings?.phone);
  const phoneHref = telHref(plain(settings?.phone));

  return {
    menu: [...pages.map((page) => page.entry), ...links],
    footer: {
      about: text(settings?.footerText),
      mailingAddress: text(settings?.mailingAddress),
      email:
        emailText && EMAIL.test(email) ? { text: emailText, href: `mailto:${email}` } : undefined,
      phone: phoneText && phoneHref ? { text: phoneText, href: phoneHref } : undefined,
      socialLinks: list(settings?.socialLinks).flatMap((item) => {
        const platform = SOCIAL_PLATFORMS.find(({ value }) => value === plain(item.platform));
        const href = safeHref(plain(item.url));
        return platform && href?.startsWith("https://") ? [{ label: platform.title, href }] : [];
      }),
    },
  };
}
