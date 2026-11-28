import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFooterNav, buildMainNav } from "@/lib/site/navigation";
import { EMPTY_SITE_CHROME } from "@/sanity/site-chrome";
import { PageHeader } from "./page-header";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { MAIN_CONTENT_ID, SkipLink } from "./skip-link";

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseConfig: vi.fn(),
}));
vi.mock("@/lib/auth/user", () => ({ getCurrentUser: auth.getCurrentUser }));
vi.mock("@/lib/supabase/config", () => ({ readSupabaseConfig: auth.readSupabaseConfig }));
// sanity/site-chrome.ts loads content through next-sanity/live, which only runs on the server.
vi.mock("@/sanity/live", () => ({ sanityFetch: vi.fn() }));

const { AccountLinks } = await import("./account-links");

describe("SiteHeader", () => {
  it("opens with the Society's logo, which links home", () => {
    // A same-page link: ESLint wants next/link for links to the site's pages.
    render(<SiteHeader items={buildMainNav([])} account={<a href="#sign-in">Sign in</a>} />);

    const home = within(screen.getByRole("banner")).getByRole("link", {
      name: "Ozark Blues Society of Northwest Arkansas",
    });
    expect(home).toHaveAttribute("href", "/");
    expect(within(home).getByRole("img")).toHaveAttribute(
      "alt",
      "Ozark Blues Society of Northwest Arkansas",
    );
  });
});

describe("SiteFooter", () => {
  it("shows the Society's details and the footer links", () => {
    render(
      <SiteFooter
        columns={buildFooterNav([
          { label: "Privacy policy", href: "/privacy", placement: "footer" },
        ])}
        settings={{
          about: "A community nonprofit.",
          mailingAddress: "PO Box 0000\nFayetteville, AR",
          email: { text: "info@example.org", href: "mailto:info@example.org" },
          phone: { text: "(479) 555-0100", href: "tel:4795550100" },
          socialLinks: [{ label: "Facebook", href: "https://facebook.example.org/ozarkblues" }],
        }}
      />,
    );

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("A community nonprofit.");
    expect(within(footer).getByText(/PO Box 0000/)).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "info@example.org" })).toHaveAttribute(
      "href",
      "mailto:info@example.org",
    );
    expect(within(footer).getByRole("link", { name: "(479) 555-0100" })).toHaveAttribute(
      "href",
      "tel:4795550100",
    );

    const links = within(screen.getByRole("navigation", { name: "Footer" }));
    expect(links.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Explore",
      "Support",
      "Stay in touch",
    ]);
    expect(links.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
    expect(links.getByRole("link", { name: "Membership" })).toHaveAttribute("href", "/join");
    expect(links.getByRole("link", { name: "Facebook" })).toHaveAttribute(
      "href",
      "https://facebook.example.org/ozarkblues",
    );
  });

  it("works with nothing from the Studio", () => {
    render(<SiteFooter columns={buildFooterNav([])} settings={EMPTY_SITE_CHROME.footer} />);

    expect(screen.getByRole("heading", { name: "Ozark Blues Society" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stay in touch" })).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo").querySelector("address")).toBeNull();
  });
});

describe("PageHeader", () => {
  it("holds the page's one level-1 heading, with optional eyebrow, intro and extras", () => {
    render(
      <PageHeader title="Events" eyebrow="On the calendar" intro="Concerts, jams and workshops.">
        <p>Members only</p>
      </PageHeader>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Events" })).toBeInTheDocument();
    expect(screen.getByText("On the calendar")).toBeInTheDocument();
    expect(screen.getByText("Concerts, jams and workshops.")).toBeInTheDocument();
    expect(screen.getByText("Members only")).toBeInTheDocument();
  });
});

describe("SkipLink", () => {
  it("goes to the main content", () => {
    render(<SkipLink />);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      `#${MAIN_CONTENT_ID}`,
    );
  });
});

describe("AccountLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.readSupabaseConfig.mockReturnValue({ url: "http://127.0.0.1:54321", publishableKey: "k" });
  });

  it("offers Sign in and Join to a visitor", async () => {
    auth.getCurrentUser.mockResolvedValue(null);
    render(await AccountLinks());

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: "My Account" })).not.toBeInTheDocument();
  });

  it("offers My Account to a signed-in member", async () => {
    auth.getCurrentUser.mockResolvedValue({ id: "u1", email: "member@example.com" });
    render(await AccountLinks());

    expect(screen.getByRole("link", { name: "My Account" })).toHaveAttribute("href", "/account");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join" })).not.toBeInTheDocument();
  });

  it("treats everyone as a visitor, without checking a session, when Supabase isn't set up", async () => {
    auth.readSupabaseConfig.mockReturnValue(null);
    render(await AccountLinks());

    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });
});
