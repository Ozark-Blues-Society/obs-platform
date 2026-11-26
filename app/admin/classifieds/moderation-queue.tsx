"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, SuccessBox, TextareaField } from "@/components/ui/form-fields";
import { Tag } from "@/components/ui/tag";
import {
  MODERATION_MESSAGES,
  categoryTitle,
  checkReason,
  formatPrice,
  type ModerationResult,
  type ModerationTarget,
  type PendingListing,
} from "@/lib/listings/moderation-state";
import { formatSocietyDate } from "@/lib/society-time";

// The Server Functions arrive as props (from page.tsx), so the queue can be tested on its own.
type Props = {
  listings: PendingListing[];
  approve: (target: ModerationTarget) => Promise<ModerationResult>;
  reject: (target: ModerationTarget & { reason: string }) => Promise<ModerationResult>;
};

// `attempt` makes each outcome a new state, so a repeat of the same message is still announced.
type Outcome = { status: "idle" } | (ModerationResult & { attempt: number });

const IDLE: Outcome = { status: "idle" };

const CONTACT = {
  email: "by email, through the website (their address stays private)",
  phone: "by phone, at the number on their profile",
} as const;

/**
 * The listings waiting for a moderator, oldest first, each with Approve and Reject. A decision
 * takes the listing out of the queue (the Server Function refreshes the page), so its outcome is
 * shown above the list, and focus moves to the list's heading.
 */
export function ModerationQueue({ listings, approve, reject }: Props) {
  const [outcome, setOutcome] = useState<Outcome>(IDLE);
  const [pending, startTransition] = useTransition();
  const attempts = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // While a decision is on its way, the last one's message is hidden: it isn't this one's outcome,
  // and the next message is then a new element, which screen readers read out even when it's the
  // same.
  const shown = pending ? IDLE : outcome;

  useEffect(() => {
    if (outcome.status === "approved" || outcome.status === "rejected") {
      headingRef.current?.focus();
    }
  }, [outcome]);

  function decide(send: () => Promise<ModerationResult>) {
    startTransition(async () => {
      let result: ModerationResult;
      try {
        result = await send();
      } catch {
        // The request didn't reach the server, or its answer didn't come back.
        result = { status: "error", message: MODERATION_MESSAGES.unavailable };
      }
      setOutcome({ ...result, attempt: ++attempts.current });
    });
  }

  return (
    <section aria-labelledby="waiting-for-review" className="mt-10">
      <h2 id="waiting-for-review" ref={headingRef} tabIndex={-1}>
        Waiting for review ({listings.length})
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
      {listings.length === 0 ? (
        <p className="mt-4">
          Nothing is waiting for review. New listings appear here as members send them.
        </p>
      ) : (
        <>
          <p className="mt-2 text-small text-muted">Oldest first.</p>
          <ol className="mt-4 space-y-4">
            {listings.map((listing) => (
              <PendingListingCard
                key={listing.id}
                listing={listing}
                pending={pending}
                onApprove={() => decide(() => approve(targetOf(listing)))}
                onReject={(reason) => decide(() => reject({ ...targetOf(listing), reason }))}
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

const targetOf = ({ id, revision }: PendingListing): ModerationTarget => ({ id, revision });

function PendingListingCard({
  listing,
  pending,
  onApprove,
  onReject,
}: {
  listing: PendingListing;
  pending: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelId = `${id}-reject`;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<{ message: string; attempt: number } | null>(null);
  const failures = useRef(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // Opening the reject form moves focus to the reason. So does each problem with it, after the
  // problem has rendered: the field's description then includes it, so screen readers read it out.
  useEffect(() => {
    if (rejecting) reasonRef.current?.focus();
  }, [rejecting]);
  useEffect(() => {
    if (problem) reasonRef.current?.focus();
  }, [problem]);

  function closeReject() {
    setRejecting(false);
    setProblem(null);
    toggleRef.current?.focus();
  }

  function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkReason(reason);
    if ("problem" in checked) {
      setProblem({ message: checked.problem, attempt: ++failures.current });
      return;
    }
    setProblem(null);
    onReject(checked.reason);
  }

  const { title, price, photo } = listing;
  return (
    <Card as="li" className="p-4 sm:p-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
        <Tag>{categoryTitle(listing.category)}</Tag>
        <span>
          by {listing.poster ?? "a member"} · sent{" "}
          <time dateTime={listing.submittedAt}>{formatSocietyDate(listing.submittedAt)}</time>
        </span>
      </p>
      <h3 id={titleId} className="mt-2 text-xl">
        {title}
        {price !== null && ` — ${formatPrice(price)}`}
      </h3>
      {photo?.status === "shown" && (
        // A private photo through a short-lived link, so not next/image: its optimizer would fetch
        // the photo and keep it at an address anyone could open.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.url}
          alt={`The photo sent with “${title}”`}
          className="mt-3 max-h-72 w-auto max-w-full rounded-lg border border-line object-contain"
        />
      )}
      {photo?.status === "missing" && (
        <p className="mt-3 text-small text-muted">
          Its photo can&rsquo;t be shown here. A photo replaced after the listing was sent never
          goes live, so if you approve it, the listing may appear without one.
        </p>
      )}
      <p className="mt-3 whitespace-pre-line">{listing.body}</p>
      <p className="mt-3 text-small text-muted">Contact: {CONTACT[listing.contactPref]}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="approve"
          size="sm"
          pending={pending}
          aria-describedby={titleId}
          onClick={onApprove}
        >
          Approve
        </Button>
        <Button
          ref={toggleRef}
          variant="reject"
          size="sm"
          aria-expanded={rejecting}
          aria-controls={panelId}
          aria-describedby={titleId}
          onClick={() => (rejecting ? closeReject() : setRejecting(true))}
        >
          Reject
        </Button>
      </div>
      <div id={panelId} hidden={!rejecting}>
        <form onSubmit={submitReject} noValidate className="mt-4">
          <TextareaField
            ref={reasonRef}
            name="reason"
            label={MODERATION_MESSAGES.reasonLabel}
            hint={MODERATION_MESSAGES.reasonHint}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={problem?.message}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" variant="reject" size="sm" pending={pending}>
              Reject and email the poster
            </Button>
            <Button variant="ghost" size="sm" onClick={closeReject}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
