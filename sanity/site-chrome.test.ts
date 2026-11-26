// @vitest-environment node
import { stegaClean } from "next-sanity";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
  cacheLife: vi.fn(),
  isConfigured: true,
}));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
// next-sanity/live only runs in React Server Components (see live.test.ts).
vi.mock("./live", () => ({ sanityFetch: mocks.sanityFetch }));
vi.mock("./env", () => ({
  get isConfigured() {
    return mocks.isConfigured;
  },
}));

const { EMPTY_SITE_CHROME, getSiteChrome, parseSiteChrome } = await import("./site-chrome");

/**
 * Appends an edit marker the way Sanity's stega encoding does in a preview (as @vercel/stega
 * encodes it): invisible characters after the text, which a link or a menu choice mustn't keep.
 */
function withEditMarker(text: string): string {
  const digits = ["​", "‌", "‍", "﻿"];
  const bytes = new TextEncoder().encode(JSON.stringify({ origin: "sanity.io", href: "/studio" }));
  const marker = [...bytes]
    .map((byte) => [6, 4, 2, 0].map((shift) => digits[(byte >> shift) & 3]).join(""))
    .join("");
  return `${text}${digits[0].repeat(4)}${marker}`;
}

const RESULT = {
  pages: [
    { title: "Venue directory", slug: "venue-directory", menuPlacement: "member-resources" },
    { title: "Contact", slug: "contact", menuPlacement: "about", menuOrder: null },
    { title: "Board", slug: "board", menuPlacement: "about", menuOrder: 2 },
    { title: "About & Volunteer", slug: "about-and-volunteer", menuPlacement: "main" },
    { title: "History", slug: "history", menuPlacement: "about", menuOrder: 1 },
    { title: "archive", slug: "archive", menuPlacement: "about" },
    // Skipped: no web address, one the Studio would refuse, an unknown menu, a blank title.
    { title: "No address", slug: null, menuPlacement: "main" },
    { title: "Bad address", slug: "Bad Address", menuPlacement: "main" },
    { title: "Nowhere", slug: "nowhere", menuPlacement: "sidebar" },
    { title: "  ", slug: "blank", menuPlacement: "main" },
    "not a page",
  ],
  settings: {
    footerText: "A community nonprofit.",
    mailingAddress: "PO Box 0000\nFayetteville, AR",
    email: "info@example.org",
    phone: "(479) 555-0100",
    socialLinks: [
      { platform: "facebook", url: "https://facebook.example.org/ozarkblues" },
      // Skipped: a platform the Studio doesn't offer, plain http, no link.
      { platform: "myspace", url: "https://myspace.example.org/ozarkblues" },
      { platform: "instagram", url: "http://instagram.example.org/ozarkblues" },
      { platform: "youtube" },
    ],
    menuLinks: [
      { label: "Festival", href: "https://festival.example.org", placement: "events" },
      // Skipped: an unsafe link, an unknown menu, a blank label.
      { label: "Sneaky", href: "javascript:alert(1)", placement: "main" },
      { label: "Lost", href: "/somewhere", placement: "nowhere" },
      { label: "", href: "/empty", placement: "main" },
    ],
  },
};

describe("parseSiteChrome", () => {
  it("orders pages by position, then title, and puts other menu links after them", () => {
    expect(parseSiteChrome(RESULT).menu).toEqual([
      { label: "History", href: "/history", placement: "about" },
      { label: "Board", href: "/board", placement: "about" },
      { label: "About & Volunteer", href: "/about-and-volunteer", placement: "main" },
      { label: "archive", href: "/archive", placement: "about" },
      { label: "Contact", href: "/contact", placement: "about" },
      { label: "Venue directory", href: "/venue-directory", placement: "member-resources" },
      { label: "Festival", href: "https://festival.example.org/", placement: "events" },
    ]);
  });

  it("reads the footer settings, with links for the email address and phone number", () => {
    expect(parseSiteChrome(RESULT).footer).toEqual({
      about: "A community nonprofit.",
      mailingAddress: "PO Box 0000\nFayetteville, AR",
      email: { text: "info@example.org", href: "mailto:info@example.org" },
      phone: { text: "(479) 555-0100", href: "tel:4795550100" },
      socialLinks: [{ label: "Facebook", href: "https://facebook.example.org/ozarkblues" }],
    });
  });

  it("leaves out what isn't set, and survives a missing or malformed result", () => {
    expect(parseSiteChrome({ pages: [], settings: null })).toEqual(EMPTY_SITE_CHROME);
    expect(parseSiteChrome(null)).toEqual(EMPTY_SITE_CHROME);
    expect(parseSiteChrome({ pages: "nope", settings: { socialLinks: {} } })).toEqual(
      EMPTY_SITE_CHROME,
    );
    expect(parseSiteChrome({ settings: { email: "not an address", phone: "x" } }).footer).toEqual({
      about: undefined,
      mailingAddress: undefined,
      email: undefined,
      phone: undefined,
      socialLinks: [],
    });
  });

  it("removes preview edit markers from links and menu choices, and keeps them on text", () => {
    const marked = withEditMarker("Board");
    expect(marked).not.toBe("Board");
    expect(stegaClean(marked)).toBe("Board");

    const chrome = parseSiteChrome({
      pages: [
        {
          title: marked,
          slug: withEditMarker("board"),
          menuPlacement: withEditMarker("about"),
          menuOrder: 1,
        },
      ],
      settings: {
        email: withEditMarker("info@example.org"),
        phone: withEditMarker("(479) 555-0100"),
        socialLinks: [
          {
            platform: withEditMarker("facebook"),
            url: withEditMarker("https://facebook.example.org/ozarkblues"),
          },
        ],
        menuLinks: [
          {
            label: withEditMarker("Festival"),
            href: withEditMarker("/festival"),
            placement: withEditMarker("events"),
          },
        ],
      },
    });

    expect(chrome.menu).toEqual([
      { label: marked, href: "/board", placement: "about" },
      { label: withEditMarker("Festival"), href: "/festival", placement: "events" },
    ]);
    expect(chrome.footer.email).toEqual({
      text: withEditMarker("info@example.org"),
      href: "mailto:info@example.org",
    });
    expect(chrome.footer.phone?.href).toBe("tel:4795550100");
    expect(chrome.footer.socialLinks).toEqual([
      { label: "Facebook", href: "https://facebook.example.org/ozarkblues" },
    ]);
  });
});

describe("getSiteChrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConfigured = true;
  });

  it("shows only the built-in parts, without asking Sanity, until a project exists", async () => {
    mocks.isConfigured = false;

    await expect(getSiteChrome({ perspective: "published", stega: false })).resolves.toEqual(
      EMPTY_SITE_CHROME,
    );
    expect(mocks.sanityFetch).not.toHaveBeenCalled();
  });

  it("fetches with the request's perspective and edit markers", async () => {
    mocks.sanityFetch.mockResolvedValue({ data: RESULT });

    const chrome = await getSiteChrome({ perspective: "drafts", stega: true });

    expect(mocks.sanityFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        perspective: "drafts",
        stega: true,
        params: { placements: ["main", "events", "about", "member-resources", "footer"] },
      }),
    );
    expect(chrome).toEqual(parseSiteChrome(RESULT));
    expect(mocks.cacheLife).not.toHaveBeenCalled();
  });

  it("falls back to the built-in parts, cached for minutes only, when Sanity fails", async () => {
    const failure = new Error("Sanity is unreachable");
    mocks.sanityFetch.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getSiteChrome({ perspective: "published", stega: false })).resolves.toEqual(
      EMPTY_SITE_CHROME,
    );
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("Sanity"), failure);
    consoleError.mockRestore();
  });
});
