import { renewListingPath } from "../lib/site/navigation";
import { EmailLayout } from "./_components/layout";
import { Details, Eyebrow, Note, Paragraph, PrimaryButton, SignOff, Title } from "./_components/ui";
import { formatDate, siteLink } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface ListingExpiringEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** The poster's profiles.first_name. Null when they didn't give one. */
  firstName: string | null;
  /** listings.id: the button opens My listings at this listing's Renew button. */
  listingId: string;
  /** listings.title, as the member wrote it. */
  listingTitle: string;
  /** listings.expires_at (ISO 8601): when the listing comes down. */
  expiresAt: string;
}

/**
 * The reminder 5 days before a classified listing expires (board decisions §7). The daily job sends
 * it (backlog K-4, lib/jobs/listings.ts), and the poster renews from My listings.
 */
export default function ListingExpiringEmail(props: ListingExpiringEmailProps) {
  const { siteUrl, listingId, listingTitle, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={ListingExpiringEmail.subject()}
      preview={`"${listingTitle}" comes down from the classifieds on ${date} unless you renew it.`}
      reason="You're getting this email because you posted a listing on the Ozark Blues Society classifieds."
      siteUrl={siteUrl}
    >
      <Eyebrow>Classifieds</Eyebrow>
      <Title>
        {firstName ? `Your listing expires soon, ${firstName}` : "Your listing expires soon"}
      </Title>
      <Paragraph>
        Your listing comes down from the classifieds on {date}. If you still need it, renew it from
        My listings: it stays up, as it is, for another 60 days from the day you renew.
      </Paragraph>
      <Details
        rows={[
          { label: "Listing", value: listingTitle },
          { label: "Expires on", value: date },
        ]}
      />
      <PrimaryButton href={siteLink(siteUrl, renewListingPath(listingId))}>
        Renew your listing
      </PrimaryButton>
      <Note>
        If you don&apos;t need it anymore, there&apos;s nothing to do: it comes down by itself.
      </Note>
      <SignOff>Thank you for posting,</SignOff>
    </EmailLayout>
  );
}

ListingExpiringEmail.subject = () => "Your classified listing expires soon";

/** Sample props for the preview server and the tests. Synthetic: not a real listing. */
ListingExpiringEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  listingId: "00000000-0000-4000-8000-000000000001",
  listingTitle: "Drummer wanted for a Friday night blues trio",
  expiresAt: "2026-12-01T18:00:00Z",
} satisfies ListingExpiringEmailProps;
