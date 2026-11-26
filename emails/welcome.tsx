import { EmailLayout } from "./_components/layout";
import {
  BulletList,
  Details,
  Eyebrow,
  Note,
  Paragraph,
  PrimaryButton,
  SignOff,
  Subheading,
  Title,
} from "./_components/ui";
import { formatDate, levelName, siteLink, type MembershipLevel } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface WelcomeEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** profiles.first_name. Null when the member didn't give one. */
  firstName: string | null;
  level: MembershipLevel;
  /** profiles.expires_at (ISO 8601): when the membership ends, or renews. */
  expiresAt: string;
  /** profiles.auto_renew. */
  autoRenew: boolean;
  /**
   * What the member's level includes: the rows of the site settings' benefits table (backlog C-1)
   * for their level, in the site's order.
   */
  benefits: readonly string[];
}

/** Sent when someone joins (decision 0002: Launch 1). The receipt is a separate email. */
export default function WelcomeEmail(props: WelcomeEmailProps) {
  const { siteUrl, level, expiresAt, autoRenew, benefits } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={WelcomeEmail.subject()}
      preview={`Your ${levelName(level)} membership is active. Here's what it includes and how to sign in.`}
      reason="You're getting this email because you joined the Ozark Blues Society."
      siteUrl={siteUrl}
    >
      <Eyebrow>New member</Eyebrow>
      <Title>
        {firstName ? `Welcome to the Society, ${firstName}!` : "Welcome to the Society!"}
      </Title>
      <Paragraph>
        Thank you for joining the Ozark Blues Society. Your membership is active.
      </Paragraph>
      <Details
        rows={[
          { label: "Membership", value: levelName(level) },
          autoRenew
            ? { label: "Renews automatically on", value: date }
            : { label: "Member until", value: date },
        ]}
      />
      {benefits.length > 0 && (
        <>
          <Subheading>What your membership includes</Subheading>
          <BulletList items={benefits} />
        </>
      )}
      <PrimaryButton href={siteLink(siteUrl, "/account")}>Go to My Account</PrimaryButton>
      <Note>
        My Account shows your membership, your renewal date and your member perk code. To sign in,
        enter the address this email was sent to, and we&apos;ll email you a sign-in link.
      </Note>
      <SignOff>See you at the next show,</SignOff>
    </EmailLayout>
  );
}

WelcomeEmail.subject = () => "Welcome to the Ozark Blues Society";

/** Sample props for the preview server and the tests. Synthetic: not a real member. */
WelcomeEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  level: "band",
  expiresAt: "2027-11-26T18:00:00Z",
  autoRenew: false,
  // The Band rows of the board's benefits table (docs/spec/board-decisions.md §1).
  benefits: [
    "Post in the classifieds",
    "Event calendar, including members-only events",
    "Monthly newsletter",
    "Eligible for VIP drawings, All Access passes and giveaways",
    "15% off Society merchandise (not bulk)",
    "Venue directory: venue names and details",
    "Venue directory: booking contacts",
    "Post gigs on the Event Calendar",
  ],
} satisfies WelcomeEmailProps;
