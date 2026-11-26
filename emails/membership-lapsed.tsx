import { EmailLayout } from "./_components/layout";
import { RenewButton } from "./_components/renewal";
import { Details, Eyebrow, Paragraph, SignOff, Title } from "./_components/ui";
import { formatDate, levelName, type MembershipLevel } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface MembershipLapsedEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** profiles.first_name. Null when the member didn't give one. */
  firstName: string | null;
  /** The level the membership was. */
  level: MembershipLevel;
  /** profiles.expires_at (ISO 8601): when the membership ended. */
  expiresAt: string;
}

/**
 * The lapsed note, 14 days after a membership ends (board decisions §4). The daily email job
 * (backlog E-2) sends it, once. It's a notice about the member's own membership, not a promotion,
 * so its subject and opening say what changed, and it carries no offers
 * (Q-20261126-104811-8667 asks Parker to confirm; a promotional email would also need the
 * Society's postal address and an opt-out).
 */
export default function MembershipLapsedEmail(props: MembershipLapsedEmailProps) {
  const { siteUrl, level, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={MembershipLapsedEmail.subject()}
      preview={`Your ${levelName(level)} membership ended on ${date}. You can renew online anytime.`}
      reason="You're getting this email because your Ozark Blues Society membership has ended. We send this note once, two weeks after a membership ends."
      siteUrl={siteUrl}
    >
      <Eyebrow>Membership ended</Eyebrow>
      <Title>
        {firstName ? `${firstName}, your membership has ended` : "Your membership has ended"}
      </Title>
      <Paragraph>
        Your Ozark Blues Society membership ended on {date}, so members-only events and pages are no
        longer open to you.
      </Paragraph>
      <Details
        rows={[
          { label: "Membership", value: levelName(level) },
          { label: "Ended on", value: date },
        ]}
      />
      <Paragraph>
        You can renew online anytime, and your member benefits start again right away.
      </Paragraph>
      <RenewButton siteUrl={siteUrl} />
      <SignOff>We hope to see you at a show soon,</SignOff>
    </EmailLayout>
  );
}

MembershipLapsedEmail.subject = () => "Your Ozark Blues Society membership has ended";

/** Sample props for the preview server and the tests. Synthetic: not a real member. */
MembershipLapsedEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  level: "band",
  expiresAt: "2026-11-12T18:00:00Z",
} satisfies MembershipLapsedEmailProps;
