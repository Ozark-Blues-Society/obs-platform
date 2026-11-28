"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { JOIN_PATH, NEW_LISTING_PATH, SIGN_IN_PATH } from "@/lib/site/navigation";

/**
 * "Post a listing" on the classifieds (backlog K-3). Posting needs an active membership
 * (board-decisions §7), so a visitor gets the approved concept's prompt to sign in or join. Signed
 * in, it opens the form, which tells a member whose membership has ended, or who never joined, to
 * renew or join (K-1). Without JavaScript, the link goes to the form, which asks a visitor to sign
 * in first.
 */
export function PostListingLink({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const label = (
    <>
      <span aria-hidden="true">+ </span>Post a listing
    </>
  );
  if (signedIn) return <ButtonLink href={NEW_LISTING_PATH}>{label}</ButtonLink>;
  return (
    <>
      <ButtonLink
        href={NEW_LISTING_PATH}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {label}
      </ButtonLink>
      <Modal open={open} onClose={() => setOpen(false)} title="Posting is a member benefit">
        <p>Sign in or join to post a free listing. Every membership level can post.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink
            href={`${SIGN_IN_PATH}?next=${encodeURIComponent(NEW_LISTING_PATH)}`}
            variant="dark"
            size="sm"
          >
            Sign in
          </ButtonLink>
          <ButtonLink href={JOIN_PATH} size="sm">
            Join
          </ButtonLink>
        </div>
      </Modal>
    </>
  );
}
