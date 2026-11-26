import type { ReactNode } from "react";
import { Body, Container, Head, Html, Link, Preview, Section, Text } from "react-email";
import { siteLink } from "../_lib/format";
import { colors, fonts } from "../_lib/theme";

export type EmailLayoutProps = {
  /** The subject line. It's also the document's title. */
  title: string;
  /** The line that inboxes show after the subject (keep it under about 90 characters). */
  preview: string;
  /** The site's address, such as https://example.org. Links in an email must be absolute. */
  siteUrl: string;
  children: ReactNode;
} & (
  | {
      /** Why the recipient got this email, for the footer of the site's own emails. */
      reason: string;
      footer?: never;
    }
  | {
      /** A footer of the template's own instead, such as the newsletter's. */
      footer: ReactNode;
      reason?: never;
    }
);

/**
 * The frame every Society email shares: a header with the logo, a card that holds the template's
 * content, and a footer. React Email lays it out with tables, which every email client supports.
 * It's 600px wide at most and narrows to fit a phone.
 */
export function EmailLayout({
  title,
  preview,
  reason,
  footer,
  siteUrl,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Light only, like the site: the color pairs are checked for contrast on light. */}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Body
        style={{
          margin: 0,
          padding: "24px 12px",
          backgroundColor: colors.canvas,
          color: colors.ink,
          fontFamily: fonts.sans,
        }}
      >
        {/* The title tag above holds the subject, so Preview mustn't add one of its own. */}
        <Preview useTitleTag={false}>{preview}</Preview>
        <Container style={{ maxWidth: "600px" }}>
          <Logo siteUrl={siteUrl} />
          <Section
            style={{
              padding: "32px 28px",
              backgroundColor: colors.surface,
              border: `1px solid ${colors.line}`,
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              wordBreak: "break-word",
            }}
          >
            {children}
          </Section>
          {footer ?? <Footer reason={reason ?? ""} siteUrl={siteUrl} />}
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Placeholder logo: the Society's name, set like the wordmark in the approved concept
 * (docs/design/prototype.html), until the real logo arrives (board decisions, "Brand and
 * content"). The real logo will be an image at an absolute URL on the site, with the Society's
 * name as its alt text.
 */
function Logo({ siteUrl }: { siteUrl: string }) {
  return (
    <Section
      style={{
        padding: "20px 28px",
        backgroundColor: colors.primaryDark,
        borderRadius: "10px 10px 0 0",
      }}
    >
      <Link
        href={siteLink(siteUrl, "/")}
        style={{ color: colors.white, textDecoration: "none" }}
        data-skip-in-text
      >
        <span
          style={{
            display: "block",
            fontFamily: fonts.serif,
            fontSize: "22px",
            lineHeight: "1.2",
          }}
        >
          Ozark Blues Society
        </span>
        <span
          style={{
            display: "block",
            marginTop: "4px",
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: colors.accentLight,
          }}
        >
          Keeping the blues alive
        </span>
      </Link>
    </Section>
  );
}

/** Text in a footer, under the card. */
export const footerText = {
  margin: "0 0 12px",
  fontSize: "13px",
  lineHeight: "1.5",
  color: colors.muted,
} as const;

/** A link in a footer. */
export const footerLink = { color: colors.primaryLight, textDecoration: "underline" } as const;

/** A footer's frame, under the card. */
export const footerSection = { padding: "24px 28px 0" } as const;

/**
 * Transactional email comes from a no-reply address (decision 0005), so the footer says where to
 * write instead.
 */
function Footer({ reason, siteUrl }: { reason: string; siteUrl: string }) {
  return (
    <Section style={footerSection}>
      <Text style={footerText}>{reason}</Text>
      <Text style={footerText}>
        Replies to this email aren&apos;t read. To reach the Society, use the{" "}
        <Link href={siteLink(siteUrl, "/contact")} style={footerLink}>
          contact page
        </Link>{" "}
        on our website.
      </Text>
      <Text style={{ ...footerText, margin: 0 }}>
        Ozark Blues Society · A community nonprofit ·{" "}
        <Link href={siteLink(siteUrl, "/")} style={footerLink}>
          {new URL(siteUrl).host}
        </Link>
      </Text>
    </Section>
  );
}
