// @vitest-environment node
// The classified listing emails: approved and rejected (backlog K-2 sends them) and the reminder
// before a listing expires (K-4). emails/templates.test.ts checks what every template shares.
import { describe, expect, it } from "vitest";
import type { EmailTemplate } from "./_lib/template";
import ListingApprovedEmail from "./listing-approved";
import ListingExpiringEmail from "./listing-expiring";
import ListingRejectedEmail, { type ListingRejectedEmailProps } from "./listing-rejected";
import { renderEmail } from "./render";

describe("listing approved", () => {
  it("says the listing is live, until when, and where to see it", async () => {
    const { subject, html, text } = await renderEmail(ListingApprovedEmail, {
      ...ListingApprovedEmail.PreviewProps,
      siteUrl: "https://example.org",
    });

    expect(subject).toBe("Your classified listing is live");
    expect(html).toContain("Your listing is live, Jordan");
    expect(text).toMatch(/Listing +Drummer wanted for a Friday night blues trio\n/);
    expect(text).toMatch(/Live until +January 25, 2027\n/);
    expect(text).toContain("see on the classifieds https://example.org/classifieds.");
    expect(text).toContain("We'll email you 5 days before it comes down");
  });
});

describe("listing rejected", () => {
  const render = (overrides: Partial<ListingRejectedEmailProps>) =>
    renderEmail(ListingRejectedEmail, { ...ListingRejectedEmail.PreviewProps, ...overrides });

  it("gives the moderator's reason and invites the poster to post again", async () => {
    const { subject, text } = await render({});

    expect(subject).toBe("Your classified listing wasn't approved");
    expect(text).toContain("Your listing wasn't approved");
    expect(text).toContain("Thank you for posting on the classifieds, Jordan.");
    expect(text).toMatch(/Listing +Vintage tube amp for sale\n/);
    expect(text).toContain(`The moderator's note\n\n${ListingRejectedEmail.PreviewProps.reason}\n`);
    expect(text).toContain("you're welcome to post it again");
  });

  it("keeps the lines of a longer note apart", async () => {
    const { html, text } = await render({ reason: "First line.\n\n Second line.\nThird line." });

    expect(text).toContain("First line.\n\nSecond line.\n\nThird line.\n");
    expect(html).toMatch(/>First line\.<\/p>/);
  });

  it("leaves the note out when there's no reason", async () => {
    const { text } = await render({ reason: " \n " });

    expect(text).not.toContain("The moderator's note");
  });

  it("shows the moderator's note as text, never as markup", async () => {
    const { html } = await render({ reason: "<script>alert(1)</script>" });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("thanks posters without a first name", async () => {
    const { text } = await render({ firstName: null });

    expect(text).toContain("Thank you for posting on the classifieds. Our moderator");
  });
});

describe("listing expiring", () => {
  it("says when the listing comes down and how to keep it up", async () => {
    const { subject, html, text } = await renderEmail(ListingExpiringEmail, {
      ...ListingExpiringEmail.PreviewProps,
      siteUrl: "https://example.org",
    });

    expect(subject).toBe("Your classified listing expires soon");
    expect(html).toContain("Your listing expires soon, Jordan");
    expect(text).toContain("comes down from the classifieds on December 1, 2026.");
    expect(text).toContain("it stays up, as it is, for another 60 days from the day you renew.");
    expect(text).toMatch(/Expires on +December 1, 2026\n/);
    expect(text).toContain("there's nothing to do: it comes down by itself");
  });

  it("opens My listings at the listing's Renew button", async () => {
    const { html, text } = await renderEmail(ListingExpiringEmail, {
      ...ListingExpiringEmail.PreviewProps,
      siteUrl: "https://example.org",
      listingId: "00000000-0000-4000-8940-000000000123",
    });

    const link = "https://example.org/account/listings?renew=00000000-0000-4000-8940-000000000123";
    expect(html).toContain(`href="${link}"`);
    expect(text).toContain(`Renew your listing ${link}`);
  });

  it("dates the expiry in the Society's time zone", async () => {
    // 9:30 PM on Dec 1 in the Ozarks is already Dec 2 in UTC.
    const { text } = await renderEmail(ListingExpiringEmail, {
      ...ListingExpiringEmail.PreviewProps,
      expiresAt: "2026-12-02T03:30:00Z",
    });

    expect(text).toMatch(/Expires on +December 1, 2026\n/);
  });
});

/** The props every listing email has. */
type ListingProps = { siteUrl: string; firstName: string | null; listingTitle: string };

/** Renders a listing email with its sample props, changed by `overrides`. */
const withOverrides =
  <Props extends ListingProps>(template: EmailTemplate<Props>) =>
  (overrides: Partial<ListingProps>) =>
    renderEmail(template, { ...template.PreviewProps, ...overrides });

describe.each([
  { name: "listing approved", render: withOverrides(ListingApprovedEmail) },
  { name: "listing rejected", render: withOverrides(ListingRejectedEmail) },
  { name: "listing expiring", render: withOverrides(ListingExpiringEmail) },
])("$name", ({ render }) => {
  it("links to My listings", async () => {
    const { html } = await render({ siteUrl: "https://example.org" });

    // The expiring email opens it at the listing (?renew=<listing id>).
    expect(html).toMatch(/href="https:\/\/example\.org\/account\/listings(\?renew=[0-9a-f-]+)?"/);
  });

  it("shows the listing's title as text, never as markup", async () => {
    const { html, text } = await render({ listingTitle: '<b>Amp</b> & "cab"' });

    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;Amp&lt;/b&gt; &amp; &quot;cab&quot;");
    expect(text).toMatch(/Listing +<b>Amp<\/b> & "cab"\n/);
  });

  it("greets posters without a first name", async () => {
    for (const firstName of [null, "", "  "]) {
      const { html } = await render({ firstName });

      expect(html).not.toContain("Jordan");
      expect(html).not.toMatch(/<h1[^>]*>\s*,|,\s*<\/h1>|classifieds, *\./);
    }
  });
});
