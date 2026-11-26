// @vitest-environment node
// The renewal reminders (30 and 7 days before a membership ends) and the lapsed note (14 days
// after), which the daily email job (backlog E-2) sends. emails/templates.test.ts checks what every
// template shares.
import { describe, expect, it } from "vitest";
import type { RenewalReminderProps } from "./_components/renewal";
import type { EmailTemplate } from "./_lib/template";
import MembershipLapsedEmail from "./membership-lapsed";
import { renderEmail } from "./render";
import RenewalLastReminderEmail from "./renewal-last-reminder";
import RenewalReminderEmail from "./renewal-reminder";

describe("renewal reminder", () => {
  it("says when the membership ends and how to renew it", async () => {
    const { subject, html, text } = await renderEmail(
      RenewalReminderEmail,
      RenewalReminderEmail.PreviewProps,
    );

    expect(subject).toBe("Time to renew your Ozark Blues Society membership");
    expect(html).toContain("Time to renew, Jordan");
    expect(text).toContain("Your membership ends on December 26, 2026.");
    expect(text).toMatch(/Membership +Band\n/);
    expect(text).toMatch(/Member until +December 26, 2026\n/);
    expect(text).toContain("Pay for another year, or choose yearly auto-renew");
    expect(text).toContain("isn't set to renew automatically");
  });
});

describe("last renewal reminder", () => {
  it("puts the end date in the subject and says access ends with the membership", async () => {
    const { subject, text } = await renderEmail(
      RenewalLastReminderEmail,
      RenewalLastReminderEmail.PreviewProps,
    );

    expect(subject).toBe("Last reminder: your membership ends on December 3, 2026");
    expect(text).toContain("Your membership ends soon, Jordan");
    expect(text).toContain("this is our last reminder");
    expect(text).toContain("your access to members-only events and pages ends with it");
    expect(text).toMatch(/Member until +December 3, 2026\n/);
  });

  it("dates the end in the Society's time zone", async () => {
    // 9:30 PM on Dec 3 in the Ozarks is already Dec 4 in UTC.
    const { subject, text } = await renderEmail(RenewalLastReminderEmail, {
      ...RenewalLastReminderEmail.PreviewProps,
      expiresAt: "2026-12-04T03:30:00Z",
    });

    expect(subject).toBe("Last reminder: your membership ends on December 3, 2026");
    expect(text).toMatch(/Member until +December 3, 2026\n/);
  });
});

describe("lapsed note", () => {
  it("says that the membership has ended, and when", async () => {
    const { subject, html, text } = await renderEmail(
      MembershipLapsedEmail,
      MembershipLapsedEmail.PreviewProps,
    );

    expect(subject).toBe("Your Ozark Blues Society membership has ended");
    expect(html).toContain("Jordan, your membership has ended");
    expect(text).toContain("ended on November 12, 2026, so members-only events and pages");
    expect(text).toMatch(/Membership +Band\n/);
    expect(text).toMatch(/Ended on +November 12, 2026\n/);
    expect(text).toContain("We send this note once, two weeks after a membership ends.");
  });
});

/** Renders one of these emails (they all take the same props) with its sample props and `overrides`. */
const withOverrides =
  <Props extends RenewalReminderProps>(template: EmailTemplate<Props>) =>
  (overrides: Partial<RenewalReminderProps>) =>
    renderEmail(template, { ...template.PreviewProps, ...overrides });

describe.each([
  {
    name: "renewal reminder",
    render: withOverrides(RenewalReminderEmail),
    untitled: "Time to renew your membership",
  },
  {
    name: "last renewal reminder",
    render: withOverrides(RenewalLastReminderEmail),
    untitled: "Your membership ends soon",
  },
  {
    name: "lapsed note",
    render: withOverrides(MembershipLapsedEmail),
    untitled: "Your membership has ended",
  },
])("$name", ({ render, untitled }) => {
  it("links to the Join page, where members renew, and says how to sign in", async () => {
    const { html, text } = await render({ siteUrl: "https://example.org" });

    expect(html).toContain('href="https://example.org/join"');
    expect(text).toContain("Renew your membership https://example.org/join");
    expect(text).toContain("enter the address this email was sent to");
  });

  it("names the member's level", async () => {
    const { text } = await render({ level: "sponsor" });

    expect(text).toMatch(/Membership +Sponsor\n/);
  });

  it("greets members without a first name", async () => {
    for (const firstName of [null, "", "  "]) {
      const { html, text } = await render({ firstName });

      expect(text).toContain(untitled);
      expect(html).not.toMatch(/<h1[^>]*>\s*,|,\s*<\/h1>/);
    }
  });

  it("shows a name as text, never as markup", async () => {
    const { html } = await render({ firstName: '<img src=x onerror="alert(1)">' });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
