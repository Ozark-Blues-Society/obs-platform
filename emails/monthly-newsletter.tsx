import { Heading, Link, Section, Text } from "react-email";
import { monthName } from "../lib/society-time";
import { BLOG_PATH, postPath } from "../sanity/paths";
import { EmailLayout, footerLink, footerSection, footerText } from "./_components/layout";
import { Eyebrow, Note, Paragraph, PrimaryButton, TextLink, Title } from "./_components/ui";
import { formatDate, siteLink } from "./_lib/format";
import { colors, fonts } from "./_lib/theme";

/** A blog post in the digest, as lib/newsletter/digest.ts loads it. */
export interface DigestPost {
  title: string;
  /** The post's web address's last part: it lives at /blog/<slug>. */
  slug: string;
  /** The category's name, such as "Recap", or "" if it has none. */
  category: string;
  /** post.publishedAt (ISO 8601). */
  publishedAt: string;
  /** Whether only members can read it. */
  membersOnly: boolean;
  /** Its short summary. Always null for a members-only post: its summary is members-only too. */
  summary: string | null;
}

export interface MonthlyNewsletterProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** The digest's month, written "2026-11". */
  month: string;
  /** The month's posts marked for the digest, latest first. */
  posts: readonly DigestPost[];
  /**
   * The Society's mailing address from Site settings, or null while nobody has entered it.
   * MailerLite's terms ask for the sender's postal address in every newsletter.
   */
  mailingAddress: string | null;
}

/**
 * The monthly newsletter (backlog E-4): the month's blog posts marked "Include in the monthly
 * email digest". The site doesn't send it: the newsletter writer pastes it into MailerLite's custom
 * HTML editor from the Monthly digest screen (app/admin/digest), and MailerLite sends it to
 * everyone on the mailing list, members or not. So a members-only post shows only its headline,
 * and the footer carries MailerLite's own links, which it fills in for each subscriber:
 * {$unsubscribe} and {$url} (the web version).
 */
export default function MonthlyNewsletter({
  siteUrl,
  month,
  posts,
  mailingAddress,
}: MonthlyNewsletterProps) {
  const [first, ...rest] = posts;
  return (
    <EmailLayout
      title={MonthlyNewsletter.subject({ month })}
      preview={
        first
          ? `New on the Society's blog: ${first.title}${rest.length > 0 ? ` and ${rest.length} more` : ""}.`
          : "News from the Ozark Blues Society."
      }
      siteUrl={siteUrl}
      footer={<NewsletterFooter siteUrl={siteUrl} mailingAddress={mailingAddress} />}
    >
      <Eyebrow>Monthly newsletter</Eyebrow>
      <Title>{MonthlyNewsletter.subject({ month })}</Title>
      <Paragraph>Here&apos;s what&apos;s new on the Society&apos;s blog.</Paragraph>
      {posts.map((post) => (
        <DigestItem key={post.slug} post={post} siteUrl={siteUrl} />
      ))}
      <PrimaryButton href={siteLink(siteUrl, BLOG_PATH)}>Read more on the blog</PrimaryButton>
    </EmailLayout>
  );
}

MonthlyNewsletter.subject = ({ month }: Pick<MonthlyNewsletterProps, "month">) =>
  `${monthName(month)} at the Ozark Blues Society`;

/** Sample props for the preview server and the tests. Synthetic posts, not the Society's. */
MonthlyNewsletter.PreviewProps = {
  siteUrl: "http://localhost:3000",
  month: "2026-11",
  posts: [
    {
      title: "Fall Fest recap: three stages and a sold-out tent",
      slug: "fall-fest-recap",
      category: "Recap",
      publishedAt: "2026-11-20T16:00:00Z",
      membersOnly: false,
      summary:
        "Photos and highlights from a weekend of blues on the square, and thanks to everyone who volunteered.",
    },
    {
      title: "Board notes: planning the winter jam series",
      slug: "board-notes-winter-jams",
      category: "Society News",
      publishedAt: "2026-11-12T18:30:00Z",
      membersOnly: true,
      summary: null,
    },
    {
      title: "Band spotlight: the Riverbend Rhythm Kings",
      slug: "spotlight-riverbend-rhythm-kings",
      category: "Band Spotlight",
      publishedAt: "2026-11-03T15:00:00Z",
      membersOnly: false,
      summary: "Thirty years of Saturday nights, and the story behind their new record.",
    },
  ],
  mailingAddress: "PO Box 0000\nExample Town, AR 00000",
} satisfies MonthlyNewsletterProps;

/** One post: its category and date, its headline, then its summary or a note that it's for members. */
function DigestItem({ post, siteUrl }: { post: DigestPost; siteUrl: string }) {
  const href = siteLink(siteUrl, postPath(post.slug));
  const meta = [post.category, formatDate(post.publishedAt), post.membersOnly && "Members only"]
    .filter(Boolean)
    .join(" · ");
  return (
    <Section style={{ padding: "20px 0 4px", borderTop: `1px solid ${colors.line}` }}>
      <Eyebrow>{meta}</Eyebrow>
      <Heading
        as="h2"
        style={{
          margin: "0 0 8px",
          fontFamily: fonts.serif,
          fontSize: "20px",
          fontWeight: "normal",
          lineHeight: "1.25",
          color: colors.ink,
        }}
      >
        <Link href={href} style={{ color: colors.ink, textDecoration: "underline" }}>
          {post.title}
        </Link>
      </Heading>
      {post.membersOnly ? (
        // Never the summary, even if one was given: it's members-only, and the newsletter
        // reaches people who aren't members.
        <Note>
          This post is for members. <TextLink href={href}>Sign in to read it</TextLink>
        </Note>
      ) : (
        <>
          {post.summary && <Paragraph>{post.summary}</Paragraph>}
          <Note>
            <TextLink href={href}>Read the post</TextLink>
          </Note>
        </>
      )}
    </Section>
  );
}

/**
 * A newsletter's footer: why it came, MailerLite's unsubscribe and web-version links, and the
 * Society's mailing address. Until the address is in Site settings, a placeholder stands in its
 * place, for the writer to notice before sending (the Monthly digest screen warns too).
 */
function NewsletterFooter({
  siteUrl,
  mailingAddress,
}: Pick<MonthlyNewsletterProps, "siteUrl" | "mailingAddress">) {
  const address = mailingAddress
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
  return (
    <Section style={footerSection}>
      <Text style={footerText}>
        You&apos;re getting this newsletter because you&apos;re a member of the Ozark Blues Society
        or signed up for its emails.
      </Text>
      <Text style={footerText}>
        <Link href="{$unsubscribe}" style={footerLink}>
          Unsubscribe
        </Link>{" "}
        ·{" "}
        <Link href="{$url}" style={footerLink}>
          View this email in your browser
        </Link>
      </Text>
      <Text style={{ ...footerText, margin: 0 }}>
        Ozark Blues Society · {address || "[The Society's mailing address, from Site settings]"} ·{" "}
        <Link href={siteLink(siteUrl, "/")} style={footerLink}>
          {new URL(siteUrl).host}
        </Link>
      </Text>
    </Section>
  );
}
