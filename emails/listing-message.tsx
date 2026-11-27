import { EmailLayout } from "./_components/layout";
import { Eyebrow, Paragraph, PrimaryButton, Quote, SignOff, Title } from "./_components/ui";
import { siteLink } from "./_lib/format";
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
  /** The sender's name from their profile ("Jordan Ellis"), or null when it has none. */
  senderName: string | null;
  /** The sender's sign-in address, which the email's Reply-To holds. */
  senderEmail: string;
  /** What the sender wrote, with plain line breaks. */
  message: string;
}

/**
 * Passes on a message that someone wrote to a classifieds poster on the listing's page (backlog
 * K-3 sends it). It goes to the poster's address, which nobody sees on the site, and replying
 * answers the sender: the email's Reply-To is the sender's address.
 */
export default function ListingMessageEmail(props: ListingMessageEmailProps) {
  const { siteUrl, listingTitle, listingPath, senderEmail, message } = props;
  const firstName = firstNameOf(props.firstName);
  const senderName = props.senderName?.trim() || null;
  const sender = senderName ?? senderEmail;

  return (
    <EmailLayout
      title={ListingMessageEmail.subject(props)}
      preview={`${sender} wrote to you about "${listingTitle}" on the classifieds.`}
      reason="You're getting this email because someone wrote to you about your listing on the Ozark Blues Society classifieds. We pass messages on without showing anyone your email address."
      siteUrl={siteUrl}
    >
      <Eyebrow>Classifieds</Eyebrow>
      <Title>
        {firstName ? `A message for you, ${firstName}` : "A message about your listing"}
      </Title>
      <Paragraph>
        {sender} wrote to you about your listing &ldquo;{listingTitle}&rdquo;:
      </Paragraph>
      <Quote text={message} />
      <Paragraph>
        To answer, reply to this email. Your reply goes to{" "}
        {senderName ? `${senderName} at ${senderEmail}` : senderEmail}, so they&apos;ll see your
        email address. Nobody sees it on the website.
      </Paragraph>
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
