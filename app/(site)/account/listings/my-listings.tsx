"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, SuccessBox } from "@/components/ui/form-fields";
import { Tag } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import { categoryTitle, formatPrice } from "@/lib/listings/moderation-state";
import {
  MY_LISTINGS_MESSAGES,
  STANDING_TONES,
  isRenewable,
  standingText,
  type ListingStanding,
  type MyListing,
  type MyListingResult,
} from "@/lib/listings/my-listings-state";
import { formatSocietyDate } from "@/lib/society-time";

/** A listing with where it stands, worked out on the server when the page was made. */
export type MyListingItem = { listing: MyListing; standing: ListingStanding };

// The Server Functions arrive as props (from page.tsx), so the list can be tested on its own.
type Props = {
  items: MyListingItem[];
  /** The member's membership is current, so they can renew. */
  canRenew: boolean;
  /** The listing a reminder email linked to (?renew=<id>): shown first, and marked. */
  highlight: string | null;
  renew: (input: { id: string }) => Promise<MyListingResult>;
  remove: (input: { id: string }) => Promise<MyListingResult>;
};

// `attempt` makes each outcome a new state, so a repeat of the same message is still announced.
type Outcome = { status: "idle" } | (MyListingResult & { attempt: number });

const IDLE: Outcome = { status: "idle" };

/**
 * The member's listings, each with where it stands and, when it can be renewed now, Renew; and
 * Remove, after a confirmation. Renewing or removing changes the list (the Server Function
 * refreshes the page), so the outcome is shown above it, and focus moves to its heading.
 */
export function MyListings({ items, canRenew, highlight, renew, remove }: Props) {
  const [outcome, setOutcome] = useState<Outcome>(IDLE);
  const [pending, startTransition] = useTransition();
  const attempts = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // While a press is on its way, the last outcome's message is hidden: it isn't this one's, and the
  // next message is then a new element, which screen readers read out even when it's the same.
  const shown = pending ? IDLE : outcome;

  useEffect(() => {
    if (outcome.status === "renewed" || outcome.status === "removed") {
      headingRef.current?.focus();
    }
  }, [outcome]);

  function act(send: () => Promise<MyListingResult>) {
    startTransition(async () => {
      let result: MyListingResult;
      try {
        result = await send();
      } catch {
        // The request didn't reach the server, or its answer didn't come back.
        result = { status: "error", message: MY_LISTINGS_MESSAGES.unavailable };
      }
      setOutcome({ ...result, attempt: ++attempts.current });
    });
  }

  // The listing the reminder was about comes first.
  const ordered = [
    ...items.filter((item) => item.listing.id === highlight),
    ...items.filter((item) => item.listing.id !== highlight),
  ];

  return (
    <section aria-labelledby="your-listings" className="mt-8">
      <h2 id="your-listings" ref={headingRef} tabIndex={-1}>
        Your listings ({items.length})
      </h2>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {shown.status !== "idle" && shown.status !== "error" && (
          <SuccessBox className="mt-4">{shown.message}</SuccessBox>
        )}
      </div>
      {shown.status === "error" && (
        <FormError key={shown.attempt} className="mt-4">
          {shown.message}
        </FormError>
      )}
      {items.length === 0 ? (
        <p className="mt-4">You haven&rsquo;t posted any listings yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {ordered.map((item) => (
            <ListingCard
              key={item.listing.id}
              item={item}
              canRenew={canRenew}
              highlighted={item.listing.id === highlight}
              pending={pending}
              onRenew={() => act(() => renew({ id: item.listing.id }))}
              onRemove={() => act(() => remove({ id: item.listing.id }))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ListingCard({
  item,
  canRenew,
  highlighted,
  pending,
  onRenew,
  onRemove,
}: {
  item: MyListingItem;
  canRenew: boolean;
  highlighted: boolean;
  pending: boolean;
  onRenew: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const confirmId = `${id}-confirm`;
  const [confirming, setConfirming] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const { listing, standing } = item;
  const { label, detail } = standingText(standing, canRenew);

  // Opening the confirmation moves focus to its button.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function keep() {
    setConfirming(false);
    toggleRef.current?.focus();
  }

  return (
    // An outline marks the listing a reminder linked to: Card has its own border, and outlines show
    // in forced-colors mode too.
    <Card
      as="li"
      className={cx("p-4 sm:p-5", highlighted && "outline-2 outline-offset-2 outline-accent")}
    >
      {highlighted && (
        <p className="text-small font-semibold text-accent-dark">
          Your reminder email was about this listing.
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
        <Tag>{categoryTitle(listing.category)}</Tag>
        <span>
          Posted <time dateTime={listing.createdAt}>{formatSocietyDate(listing.createdAt)}</time>
        </span>
      </p>
      <h3 id={titleId} className="mt-2 text-xl wrap-anywhere">
        {listing.title}
        {listing.price !== null && ` — ${formatPrice(listing.price)}`}
      </h3>
      <p className="mt-3">
        <Tag tone={STANDING_TONES[standing.kind]}>{label}</Tag>
      </p>
      <p className="mt-2 whitespace-pre-line wrap-anywhere">{detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canRenew && isRenewable(standing) && (
          <Button
            variant="dark"
            size="sm"
            pending={pending}
            aria-describedby={titleId}
            onClick={onRenew}
          >
            Renew
          </Button>
        )}
        <Button
          ref={toggleRef}
          variant="reject"
          size="sm"
          aria-expanded={confirming}
          aria-controls={confirmId}
          aria-describedby={titleId}
          onClick={() => (confirming ? keep() : setConfirming(true))}
        >
          Remove
        </Button>
      </div>
      <div id={confirmId} hidden={!confirming} className="mt-4 rounded-lg bg-canvas p-4">
        <p>
          Remove &ldquo;{listing.title}&rdquo; for good? It comes off the classifieds, and it
          can&rsquo;t be brought back.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button ref={confirmRef} variant="reject" size="sm" pending={pending} onClick={onRemove}>
            Remove the listing
          </Button>
          <Button variant="ghost" size="sm" onClick={keep}>
            Keep it
          </Button>
        </div>
      </div>
    </Card>
  );
}
