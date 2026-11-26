// @vitest-environment node
// The monthly newsletter (backlog E-4), which the newsletter writer pastes into MailerLite.
// emails/templates.test.ts checks what every template shares.
import { describe, expect, it } from "vitest";
import MonthlyNewsletter, {
  type DigestPost,
  type MonthlyNewsletterProps,
} from "./monthly-newsletter";
import { renderEmail } from "./render";

const render = (overrides: Partial<MonthlyNewsletterProps> = {}) =>
  renderEmail(MonthlyNewsletter, {
    ...MonthlyNewsletter.PreviewProps,
    siteUrl: "https://example.org",
    ...overrides,
  });

const post = (overrides: Partial<DigestPost> = {}): DigestPost => ({
  title: "Fall Fest recap",
  slug: "fall-fest-recap",
  category: "Recap",
  publishedAt: "2026-11-20T16:00:00Z",
  membersOnly: false,
  summary: "Highlights from the weekend.",
  ...overrides,
});

describe("monthly newsletter", () => {
  it("is titled with its month", async () => {
    const { subject, html } = await render({ month: "2027-01" });

    expect(subject).toBe("January 2027 at the Ozark Blues Society");
    expect(html).toMatch(/<h1[^>]*>January 2027 at the Ozark Blues Society<\/h1>/);
  });

  it("lists each post in the order given, with its headline, category, date and summary", async () => {
    const { text } = await render();

    expect(text).toContain(
      [
        "Recap · November 20, 2026",
        "",
        "",
        "Fall Fest recap: three stages and a sold-out tent https://example.org/blog/fall-fest-recap",
        "",
        "Photos and highlights from a weekend of blues on the square, and thanks to everyone who volunteered.",
        "",
        "Read the post https://example.org/blog/fall-fest-recap",
      ].join("\n"),
    );
    const order = ["Fall Fest recap", "Board notes", "Band spotlight"].map((title) =>
      text.indexOf(title),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text).toContain("Read more on the blog https://example.org/blog");
  });

  it("gives a members-only post its headline and a link to sign in, never its summary", async () => {
    const { html, text } = await render({
      posts: [
        post({
          title: "Board notes",
          slug: "board-notes",
          category: "Society News",
          membersOnly: true,
          summary: "MEMBERS-ONLY SUMMARY",
        }),
      ],
    });

    expect(text).toContain("Society News · November 20, 2026 · Members only");
    expect(text).toContain("Board notes https://example.org/blog/board-notes");
    expect(text).toContain(
      "This post is for members. Sign in to read it https://example.org/blog/board-notes",
    );
    expect(html).not.toContain("MEMBERS-ONLY SUMMARY");
  });

  it("leaves out what a post doesn't have", async () => {
    const { text } = await render({ posts: [post({ category: "", summary: null })] });

    expect(text).toMatch(/\nNovember 20, 2026\n/);
    expect(text).toContain(
      "Fall Fest recap https://example.org/blog/fall-fest-recap\n\nRead the post https://example.org/blog/fall-fest-recap",
    );
  });

  it("shows editors' text as text, never as markup", async () => {
    const { html } = await render({
      posts: [post({ title: "<b>Bold</b> & loud", summary: "<script>alert(1)</script>" })],
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;Bold&lt;/b&gt; &amp; loud");
  });

  it("previews the first headline and how many more follow", async () => {
    const preview = async (posts: DigestPost[]) => {
      const { html } = await render({ posts });
      return html.match(/<div [^>]*data-skip-in-text="true"[^>]*>([^<]+)</)?.[1].trim();
    };

    expect(await preview([post(), post({ slug: "b" }), post({ slug: "c" })])).toBe(
      "New on the Society&#x27;s blog: Fall Fest recap and 2 more.",
    );
    expect(await preview([post()])).toBe("New on the Society&#x27;s blog: Fall Fest recap.");
    expect(await preview([])).toBe("News from the Ozark Blues Society.");
  });

  it("ends with MailerLite's unsubscribe and web-version links and the mailing address", async () => {
    const { html, text } = await render({
      mailingAddress: " PO Box 0000\n\nExample Town, AR 00000\n",
    });

    expect(html).toMatch(/<a href="\{\$unsubscribe\}"[^>]*>Unsubscribe<\/a>/);
    expect(html).toMatch(/<a href="\{\$url\}"[^>]*>View this email in your browser<\/a>/);
    expect(text).toContain(
      "Ozark Blues Society · PO Box 0000, Example Town, AR 00000 · example.org https://example.org/",
    );
    expect(text).toContain("a member of the Ozark Blues Society or signed up for its emails.");
  });

  it("holds a place for the mailing address until Site settings has one", async () => {
    for (const mailingAddress of [null, " \n "]) {
      const { text } = await render({ mailingAddress });
      expect(text).toContain(
        "Ozark Blues Society · [The Society's mailing address, from Site settings] · example.org",
      );
    }
  });

  it("stays well under the size at which Gmail clips an email, even in a busy month", async () => {
    // The longest headlines (120 characters) and summaries (200) the Studio allows. MailerLite
    // adds its own tracking to every link, and Gmail clips an email over 102 KB.
    const posts = Array.from({ length: 20 }, (_, index) =>
      post({
        title: "H".repeat(120),
        slug: `post-${index}-${"s".repeat(60)}`,
        summary: "S".repeat(200),
        membersOnly: index % 4 === 0,
      }),
    );
    const { html } = await render({ posts });

    expect(Buffer.byteLength(html)).toBeLessThan(60 * 1024);
  });
});
