# 0003 — Member gig submission (complimentary add-on)

Status: Accepted (Parker, 2026-11-26). In scope now; not a Change Order and not billed. Launch 2.

## Decision

Band, Business and Sponsor members can submit their gigs from My Account. A submission creates a
**draft event** in Sanity for an editor to review and publish. Members never publish directly.

## Requirements

- Who: active members at Band, Business or Sponsor level (server-side check; Individual members don't
  see the form).
- Form fields: title, date, start time, venue (pick an existing venue or enter a new one), price text,
  description, optional image. Validated server-side.
- On submit: create a Sanity draft (`drafts.` document) of type `event` with `submittedBy` (profile id
  and name) and `submissionStatus: pending`, using a server-only write token. New venues are created as
  drafts too.
- Editors are emailed (Resend) that a gig is waiting, with a link into the Studio. The Studio shows a
  "Member submissions" list filtered to pending drafts.
- The member sees their submissions and status (pending / published / declined) in My Account.
- Abuse limits: max 5 pending submissions per member; basic rate limit; image size/type limits.
- Tests: level check (Individual and non-members refused), draft created unpublished, rate limit.
