import Link from "next/link";
import type { ComponentProps } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { categoryTitle, formatPrice } from "@/lib/listings/moderation-state";
import { listingPath, type ListingDetail } from "@/lib/listings/public-state";
import { CLASSIFIEDS_PATH, SIGN_IN_PATH, telHref } from "@/lib/site/navigation";
import { formatSocietyDate } from "@/lib/society-time";
import { ContactForm } from "./contact-form";

type ListingViewProps = {
  listing: ListingDetail;
  /** The contact form's Server Function, made by the page for this listing. */
  contact: ComponentProps<typeof ContactForm>["action"];
};

/**
 * A live listing's own page (backlog K-3): its category, title, price, photo and details, who
 * posted it and when, and how to reach the poster (decision 0009). The poster's email address
 * never reaches the page: anyone writes through the site. A poster's phone number reaches it only
 * for a signed-in viewer, when the poster asked for calls.
 *
 * Members write titles and details, and a long web address is common in classifieds, so both wrap
 * anywhere rather than widen the page.
 */
export function ListingView({ listing, contact }: ListingViewProps) {
  const { title, price, photo, poster } = listing;
  return (
    <>
      <PageHeader
        title={<span className="block wrap-break-word">{title}</span>}
        eyebrow={categoryTitle(listing.category)}
      />
      <div className="mx-auto grid w-full max-w-site gap-8 px-gutter py-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="min-w-0">
          {price !== null && <p className="text-lead font-semibold">{formatPrice(price)}</p>}
          {photo?.status === "shown" && (
            // A private photo through a short-lived link, so not next/image: its optimizer would
            // fetch the photo and keep it at an address anyone could open.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={`The poster's photo for “${title}”`}
              className="mt-4 max-h-112 w-auto max-w-full rounded-card border border-line object-contain"
            />
          )}
          <p className="mt-4 max-w-prose whitespace-pre-line wrap-break-word">{listing.body}</p>
          <p className="mt-4 text-small text-muted">
            Posted by {poster ?? "a member"} on{" "}
            <time dateTime={listing.postedAt}>{formatSocietyDate(listing.postedAt)}</time>
          </p>
          <p className="mt-8">
            <Link href={CLASSIFIEDS_PATH}>See all listings</Link>
          </p>
        </article>
        <Card
          as="section"
          id="contact"
          aria-labelledby="contact-heading"
          className="scroll-mt-6 p-5 lg:col-start-2"
        >
          <h2 id="contact-heading" className="text-h3">
            Contact the poster
          </h2>
          <ContactPoster listing={listing} contact={contact} />
        </Card>
      </div>
    </>
  );
}

function ContactPoster({ listing, contact }: ListingViewProps) {
  const who = listing.poster ?? "the poster";
  switch (listing.contact.kind) {
    case "own":
      return (
        <p className="mt-2">
          This is your listing. People contact you the way you chose when you posted it.
        </p>
      );
    case "phone": {
      const { phone } = listing.contact;
      const href = telHref(phone);
      return (
        <>
          <p className="mt-2">{who} asked to be contacted by phone:</p>
          <p className="mt-2 text-lead font-semibold">
            {href ? <a href={href}>{phone}</a> : phone}
          </p>
        </>
      );
    }
    case "message":
      return (
        <>
          {listing.contact.phoneForMembers && (
            <p className="mt-2">
              {who} prefers phone calls.{" "}
              <Link href={`${SIGN_IN_PATH}?next=${encodeURIComponent(listingPath(listing.id))}`}>
                Sign in
              </Link>{" "}
              to see their number, or write to them here.
            </p>
          )}
          <ContactForm
            action={contact}
            poster={listing.poster}
            defaults={listing.contact.defaults}
          />
        </>
      );
  }
}
