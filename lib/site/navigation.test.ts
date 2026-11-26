import { describe, expect, it } from "vitest";
import {
  buildFooterNav,
  buildMainNav,
  isCurrentPage,
  isInSection,
  safeHref,
  telHref,
  type MenuEntry,
} from "./navigation";

const MENU: MenuEntry[] = [
  { label: "About & Volunteer", href: "/about-and-volunteer", placement: "main" },
  { label: "Blues Challenge 2027", href: "/blues-challenge", placement: "events" },
  { label: "Board", href: "/board", placement: "about" },
  { label: "Venue directory", href: "/venue-directory", placement: "member-resources" },
  { label: "Privacy policy", href: "/privacy", placement: "footer" },
  { label: "Festival site", href: "https://festival.example.org/", placement: "main" },
];

describe("buildMainNav", () => {
  it("always has the concept's sections, in its order", () => {
    expect(buildMainNav([])).toEqual([
      { kind: "link", label: "Events", href: "/events" },
      { kind: "link", label: "Blog", href: "/blog" },
      { kind: "link", label: "Sponsors", href: "/sponsors" },
      { kind: "link", label: "Donate", href: "/donate" },
    ]);
  });

  it("adds editors' entries: main-menu ones after Sponsors, the rest in their groups", () => {
    expect(buildMainNav(MENU)).toEqual([
      {
        kind: "group",
        label: "Events",
        links: [
          { label: "Events calendar", href: "/events" },
          { label: "Blues Challenge 2027", href: "/blues-challenge" },
        ],
      },
      { kind: "link", label: "Blog", href: "/blog" },
      { kind: "link", label: "Sponsors", href: "/sponsors" },
      { kind: "link", label: "About & Volunteer", href: "/about-and-volunteer" },
      { kind: "link", label: "Festival site", href: "https://festival.example.org/" },
      { kind: "group", label: "About", links: [{ label: "Board", href: "/board" }] },
      {
        kind: "group",
        label: "Member Resources",
        links: [{ label: "Venue directory", href: "/venue-directory" }],
      },
      { kind: "link", label: "Donate", href: "/donate" },
    ]);
  });
});

describe("buildFooterNav", () => {
  it("puts editors' footer entries under Explore, after Events and Blog", () => {
    expect(buildFooterNav(MENU)).toEqual([
      {
        heading: "Explore",
        links: [
          { label: "Events", href: "/events" },
          { label: "Blog", href: "/blog" },
          { label: "Privacy policy", href: "/privacy" },
        ],
      },
      {
        heading: "Support",
        links: [
          { label: "Membership", href: "/join" },
          { label: "Donate", href: "/donate" },
          { label: "Sponsor", href: "/sponsors" },
        ],
      },
    ]);
  });
});

describe("current page and section", () => {
  it("matches the exact page only for the current page", () => {
    expect(isCurrentPage("/blog", "/blog")).toBe(true);
    expect(isCurrentPage("/blog", "/blog/fall-fest-recap")).toBe(false);
    expect(isCurrentPage("/blog", null)).toBe(false);
  });

  it("counts pages under a link as its section, but never the home page", () => {
    expect(isInSection("/blog", "/blog/fall-fest-recap")).toBe(true);
    expect(isInSection("/blog", "/blog")).toBe(true);
    expect(isInSection("/blog", "/blogroll")).toBe(false);
    expect(isInSection("/", "/blog")).toBe(false);
    expect(isInSection("https://example.org/blog", "/blog")).toBe(false);
    expect(isInSection("/blog", null)).toBe(false);
  });
});

describe("safeHref", () => {
  it.each([
    ["/events", "/events"],
    [" /events?month=12#list ", "/events?month=12#list"],
    ["https://festival.example.org/tickets", "https://festival.example.org/tickets"],
    ["http://example.org", "http://example.org/"],
    ["mailto:info@example.org", "mailto:info@example.org"],
    ["tel:+1 (479) 555-0100", "tel:+14795550100"],
  ])("accepts %j", (value, expected) => {
    expect(safeHref(value)).toBe(expected);
  });

  it.each([
    "",
    "events",
    "//evil.example",
    "/\\evil.example",
    "/ events",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.org/file",
    "https://localhost/",
    "mailto:nobody",
    "tel:555",
  ])("refuses %j", (value) => {
    expect(safeHref(value)).toBeNull();
  });
});

describe("telHref", () => {
  it("keeps the digits and a leading plus", () => {
    expect(telHref("(479) 555-0100")).toBe("tel:4795550100");
    expect(telHref("+1 479.555.0100")).toBe("tel:+14795550100");
  });

  it("refuses something too short to be a phone number", () => {
    expect(telHref("555-01")).toBeNull();
    expect(telHref("")).toBeNull();
  });
});
