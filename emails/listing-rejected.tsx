import { MY_LISTINGS_PATH } from "../lib/site/navigation";
import { EmailLayout } from "./_components/layout";
import {
  Details,
  Eyebrow,
  Paragraph,
  PrimaryButton,
  Quote,
  SignOff,
  Subheading,
  Title,
} from "./_components/ui";
import { siteLink } from "./_lib/format";
import { firstNameOf } from "./_lib/template";

export interface ListingRejectedEmailProps {
  /** The site's address, such as https://example.org. */
  siteUrl: string;
  /** The poster's profiles.first_name. Null when they didn't give one. */
  firstName: string | null;
  /** listings.title, as the member wrote it. */
  listingTitle: string;
  /** listings.reject_reason: the moderator's note to the poster, as the moderator wrote it. */
  reason: string;
}

/**
 * Tells the poster that a moderator didn't approve their classified listing, with the moderator's
 * reason in their own words (backlog K-2 sends it).
 */
export default function ListingRejectedEmail(props: ListingRejectedEmailProps) {
  const { siteUrl, listingTitle, reason } = props;
  const firstName = firstNameOf(props.firstName);

  return (
    <EmailLayout
      title={ListingRejectedEmail.subject()}
      preview={`Our moderator didn't approve "${listingTitle}". Here's why, and how to post again.`}
      reason="You're getting this email because you posted a listing on the Ozark Blues Society classifieds."
      siteUrl={siteUrl}
    >
      <Eyebrow>Classifieds</Eyebrow>
      <Title>Your listing wasn&apos;t approved</Title>
      <Paragraph>
        {firstName
          ? `Thank you for posting on the classifieds, ${firstName}.`
          : "Thank you for posting on the classifieds."}{" "}
        Our moderator reviewed your listing and couldn&apos;t approve it, so it isn&apos;t on the
        site.
      </Paragraph>
      <Details rows={[{ label: "Listing", value: listingTitle }]} />
      {reason.trim() && (
        <>
          <Subheading>The moderator&apos;s note</Subheading>
          <Quote text={reason} />
        </>
      )}
      <Paragraph>
        If you can change your listing to fit, you&apos;re welcome to post it again.
      </Paragraph>
      <PrimaryButton href={siteLink(siteUrl, MY_LISTINGS_PATH)}>Go to My listings</PrimaryButton>
      <SignOff>With thanks,</SignOff>
    </EmailLayout>
  );
}

ListingRejectedEmail.subject = () => "Your classified listing wasn't approved";

/** Sample props for the preview server and the tests. Synthetic: not a real listing. */
ListingRejectedEmail.PreviewProps = {
  siteUrl: "http://localhost:3000",
  firstName: "Jordan",
  listingTitle: "Vintage tube amp for sale",
  // The board's categories (docs/spec/board-decisions.md §7).
  reason:
    "Instruments and equipment for sale go in the Gear category, with a price. Please post it again there.",
} satisfies ListingRejectedEmailProps;
