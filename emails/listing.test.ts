// @vitest-environment node
// The classified listing emails: approved and rejected (backlog K-2 sends them), the reminder
// before a listing expires (K-4), and a message someone wrote to the poster on the listing's page
// (K-3). emails/templates.test.ts checks what every template shares.
import { describe, expect, it } from "vitest";
import type { EmailTemplate } from "./_lib/template";
import ListingApprovedEmail from "./listing-approved";
import ListingExpiringEmail from "./listing-expiring";
import ListingMessageEmail, { type ListingMessageEmailProps } from "./listing-message";
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
    expect(text).toMatch(/Expires on +December 1, 2026\n/);
    expect(text).toContain("Renew your listing https://example.org/account/listings");
    expect(text).toContain("there's nothing to do: it comes down by itself");
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

    expect(html).toContain('href="https://example.org/account/listings"');
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

describe("listing message", () => {
  const render = (overrides: Partial<ListingMessageEmailProps>) =>
    renderEmail(ListingMessageEmail, { ...ListingMessageEmail.PreviewProps, ...overrides });
  /** The text without the invisible characters that keep addresses from becoming links. */
  const plain = (text: string) => text.replaceAll(String.fromCodePoint(0x2060), "");

  it("passes the message on, with who wrote it and how to reply", async () => {
    const { subject, html, text } = await render({ siteUrl: "https://example.org" });

    expect(subject).toBe("A message about your listing “Tweed-style 1x12 tube amp, 15 W”");
    expect(html).toContain("A message for you, Marcus");
    expect(plain(text)).toContain(
      "Jordan Ellis (jordan.ellis@example.com) wrote to you through the Society's website about your listing “Tweed-style 1x12 tube amp, 15 W”:",
    );
    expect(text).toContain("Hi Marcus, is the amp still for sale?");
    expect(text).toContain("\n\nThanks!\n");
    expect(text).toContain("Your reply goes to the address they gave, so they'll see your email");
    expect(html).toContain(
      'href="https://example.org/classifieds/00000000-0000-4000-8000-000000000000"',
    );
  });

  it("says anyone can write, and the address is unchecked", async () => {
    const { text } = await render({});

    expect(text).toContain(
      "Anyone can write through the classifieds. We haven't checked that this address belongs to Jordan Ellis",
    );
  });

  it("says replies go to the sender, not to the Society", async () => {
    const { text } = await render({});

    expect(plain(text)).toContain(
      "Replying to this email writes to jordan.ellis@example.com, not to the Society.",
    );
    expect(text).not.toContain("Replies to this email aren't read.");
  });

  it("turns no address in the message, or the sender's, into a link", async () => {
    const { html, text } = await render({
      senderEmail: "jo@example.com",
      message: "Pics at https://photos.example.com/amp or mail me at jo@example.com.",
    });

    expect(html).not.toMatch(/href="(?:https?:\/\/photos|mailto:)/);
    expect(plain(text)).toContain(
      "Pics at https://photos.example.com/amp or mail me at jo@example.com.",
    );
    expect(text).not.toContain("https://photos.example.com");
    expect(text).not.toContain("jo@example.com");
  });

  it("names a sender without a name by their address", async () => {
    const { text } = await render({ senderName: "  " });

    expect(plain(text)).toContain("jordan.ellis@example.com (jordan.ellis@example.com) wrote");
  });

  it("shows what people wrote as text, never as markup", async () => {
    const { html } = await render({
      listingTitle: "<b>Amp</b>",
      senderName: "<i>Jo</i>",
      message: "<script>alert(1)</script>",
    });

    for (const tag of ["<b>", "<i>", "<script>"]) expect(html).not.toContain(tag);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps the subject on one line, whatever the title holds", async () => {
    const { subject } = await render({ listingTitle: "Amp\r\nBcc: someone@example.com " });

    expect(subject).toBe("A message about your listing “Amp Bcc: someone@example.com”");
  });

  it("greets posters without a first name", async () => {
    const { html } = await render({ firstName: null });

    expect(html).toMatch(/<h1[^>]*>A message about your listing<\/h1>/);
  });
});
