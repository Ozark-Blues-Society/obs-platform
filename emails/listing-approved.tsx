import { CLASSIFIEDS_PATH, MY_LISTINGS_PATH } from "../lib/site/navigation";
import { EmailLayout } from "./_components/layout";
import {
  Details,
  Eyebrow,
  Paragraph,
  PrimaryButton,
  SignOff,
  TextLink,
  Title,
} from "./_components/ui";
import { formatDate, siteLink } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface ListingApprovedEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** The poster's profiles.first_name. Null when they didn't give one. */
  firstName: string | null;
  /** listings.title, as the member wrote it. */
  listingTitle: string;
  /** listings.expires_at (ISO 8601): 60 days after approval (board decisions §7). */
  expiresAt: string;
}

/** Tells the poster that a moderator approved their classified listing (backlog K-2 sends it). */
export default function ListingApprovedEmail(props: ListingApprovedEmailProps) {
  const { siteUrl, listingTitle, expiresAt } = props;
  const firstName = firstNameOf(props.firstName);
  const date = formatDate(expiresAt);

  return (
    <EmailLayout
      title={ListingApprovedEmail.subject()}
      preview={`"${listingTitle}" is now on the Ozark Blues Society classifieds, until ${date}.`}
      reason="You're getting this email because you posted a listing on the Ozark Blues Society classifieds."
      siteUrl={siteUrl}
    >
      <Eyebrow>Classifieds</Eyebrow>
      <Title>{firstName ? `Your listing is live, ${firstName}` : "Your listing is live"}</Title>
      <Paragraph>
        Our moderator approved your listing, and it&apos;s now up for everyone to see on{" "}
        <TextLink href={siteLink(siteUrl, CLASSIFIEDS_PATH)}>the classifieds</TextLink>.
      </Paragraph>
      <Details
        rows={[
          { label: "Listing", value: listingTitle },
          { label: "Live until", value: date },
        ]}
      />
      <Paragraph>
        We&apos;ll email you 5 days before it comes down, so you can renew it if you still need it.
      </Paragraph>
      <PrimaryButton href={siteLink(siteUrl, MY_LISTINGS_PATH)}>Go to My listings</PrimaryButton>
      <SignOff>Good luck with your listing,</SignOff>
    </EmailLayout>
  );
}

ListingApprovedEmail.subject = () => "Your classified listing is live";

/** Sample props for the preview server and the tests. Synthetic: not a real listing. */
ListingApprovedEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  listingTitle: "Drummer wanted for a Friday night blues trio",
  expiresAt: "2027-01-25T18:00:00Z",
} satisfies ListingApprovedEmailProps;
