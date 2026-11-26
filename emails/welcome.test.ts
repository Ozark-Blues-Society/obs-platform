// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BOARD_BENEFITS } from "@/sanity/schemas/documents/site-settings";
import { renderEmail } from "./render";
import WelcomeEmail, { type WelcomeEmailProps } from "./welcome";

const props = WelcomeEmail.PreviewProps;
const renderWelcome = (overrides: Partial<WelcomeEmailProps> = {}) =>
  renderEmail(WelcomeEmail, { ...props, ...overrides });

describe("welcome email", () => {
  it("previews with the benefits a Band member gets from the board's table", () => {
    // The sender passes the rows of the site settings' benefits table for the member's level.
    const bandRows = BOARD_BENEFITS.filter((row) => row.levels.includes("band"));
    expect(props.level).toBe("band");
    expect(props.benefits).toEqual(bandRows.map((row) => row.benefit));
  });

  it("welcomes the member by name, with their level and membership dates", async () => {
    const { subject, html, text } = await renderWelcome();

    expect(subject).toBe("Welcome to the Ozark Blues Society");
    for (const version of [html, text]) {
      expect(version).toContain("Welcome to the Society, Jordan!");
      expect(version).toContain("Your membership is active.");
    }
    expect(text).toMatch(/Membership +Band\n/);
    expect(text).toMatch(/Member until +November 26, 2027\n/);
    expect(text).not.toContain("Renews automatically");
  });

  it("lists what the member's level includes", async () => {
    const { text } = await renderWelcome();

    expect(text).toContain("What your membership includes");
    for (const benefit of props.benefits) expect(text).toContain(` * ${benefit}\n`);
  });

  it("leaves the list out when there are no benefits to show", async () => {
    const { html } = await renderWelcome({ benefits: [] });

    expect(html).not.toContain("What your membership includes");
    expect(html).not.toContain("<ul");
  });

  it("links to My Account and explains how to sign in", async () => {
    const { html, text } = await renderWelcome({ siteUrl: "https://example.org" });

    expect(html).toContain('href="https://example.org/account"');
    expect(text).toContain("Go to My Account https://example.org/account");
    expect(text).toContain("we'll email you a sign-in link");
  });

  it("says when an auto-renewing membership renews", async () => {
    const { text } = await renderWelcome({ autoRenew: true });

    expect(text).toMatch(/Renews automatically on +November 26, 2027\n/);
    expect(text).not.toContain("Member until");
  });

  it("greets members without a first name", async () => {
    for (const firstName of [null, "", "  "]) {
      const { html, text } = await renderWelcome({ firstName });

      expect(text).toContain("Welcome to the Society!");
      expect(html).not.toMatch(/Society, *!/);
    }
  });

  it("shows member-supplied text as text, never as markup", async () => {
    const { html } = await renderWelcome({
      firstName: '<img src=x onerror="alert(1)">',
      benefits: ["<b>Bold</b> & more"],
    });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;b&gt;Bold&lt;/b&gt; &amp; more");
  });
});
