import { EmailLayout } from "./_components/layout";
import { Eyebrow, Note, Paragraph, PrimaryButton, Quote, SignOff, Title } from "./_components/ui";
import { siteLink, unlinkText } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface ListingMessageEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** The poster's profiles.first_name. Null when they didn't give one. */
  firstName: string | null;
  /** listings.title, as the poster wrote it. */
  listingTitle: string;
  /** The listing's page on the site, such as /classifieds/<id>. */
  listingPath: string;
  /** The name the sender gave. */
  senderName: string;
  /** The address the sender gave, which the email's Reply-To holds. Nobody has checked it. */
  senderEmail: string;
  /** What the sender wrote, with plain line breaks. */
  message: string;
}

/**
 * Passes on a message that someone wrote to a classifieds poster on the listing's page (backlog
 * K-3 sends it; decision 0009). It goes to the poster's address, which nobody sees on the site, and
 * replying answers the sender: the email's Reply-To is the address they gave. Anyone can write, so
 * the email says the address is unchecked, and the message's links are plain text.
 */
export default function ListingMessageEmail(props: ListingMessageEmailProps) {
  const { siteUrl, listingTitle, listingPath, senderEmail, message } = props;
  const firstName = firstNameOf(props.firstName);
  const senderName = props.senderName.trim() || senderEmail;

  return (
    <EmailLayout
      title={ListingMessageEmail.subject(props)}
      preview={`${senderName} wrote to you about "${listingTitle}" on the classifieds.`}
      reason="You're getting this email because someone wrote to you about your listing on the Ozark Blues Society classifieds. We pass messages on without showing anyone your email address."
      repliesGoTo={unlinkText(senderEmail)}
      siteUrl={siteUrl}
    >
      <Eyebrow>Classifieds</Eyebrow>
      <Title>
        {firstName ? `A message for you, ${firstName}` : "A message about your listing"}
      </Title>
      <Paragraph>
        {senderName} ({unlinkText(senderEmail)}) wrote to you through the Society&apos;s website
        about your listing &ldquo;{listingTitle}&rdquo;:
      </Paragraph>
      <Quote text={unlinkText(message)} />
      <Paragraph>
        To answer, reply to this email. Your reply goes to the address they gave, so they&apos;ll
        see your email address. Nobody sees it on the website.
      </Paragraph>
      <Note>
        Anyone can write through the classifieds. We haven&apos;t checked that this address belongs
        to {senderName}, and we show links in messages as plain text. Take care before you share
        personal details or send money.
      </Note>
      <PrimaryButton href={siteLink(siteUrl, listingPath)}>See your listing</PrimaryButton>
      <SignOff>Good luck with your listing,</SignOff>
    </EmailLayout>
  );
}

/** The title on one line, whatever reached the database. */
ListingMessageEmail.subject = (props: Pick<ListingMessageEmailProps, "listingTitle">) =>
  `A message about your listing “${props.listingTitle.replace(/\s+/g, " ").trim()}”`;

/** Sample props for the preview server and the tests. Synthetic: no real people or listing. */
ListingMessageEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Marcus",
  listingTitle: "Tweed-style 1x12 tube amp, 15 W",
  listingPath: "/classifieds/00000000-0000-4000-8000-000000000000",
  senderName: "Jordan Ellis",
  senderEmail: "jordan.ellis@example.com",
  message:
    "Hi Marcus, is the amp still for sale? I could come by on Saturday morning to try it.\nThanks!",
} satisfies ListingMessageEmailProps;
