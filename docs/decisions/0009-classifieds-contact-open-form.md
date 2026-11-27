# 0009 — Anyone can contact a classifieds poster through a site form

Status: Accepted (Parker, 2026-11-27, Q-20261127-194828-27977, option B).

## Decision

Anyone, visitors included, can contact a classifieds poster through a form on the listing page (name,
email, message). The poster's email address is never shown. The message reaches the poster by email,
with the sender's details so they can reply.

Because the form is open to visitors, it needs anti-spam measures without adding a third party:
- a hidden-field trap and a minimum time-to-submit;
- per-email and per-IP rate limits, and a daily cap per listing;
- server-side validation and length limits; links in messages aren't clickable;
- each message says it was sent through the Society's site and from an unverified address.

No CAPTCHA service (that would be a new third party; ask Parker first if one becomes necessary).

**Phone numbers:** the question's option B said phone numbers would become public. Parker hasn't said
so explicitly, so until he does, a phone number a poster chose to show stays visible to signed-in
people only.

## Options considered

- A) Signed-in people only (the concept's behavior).
- B) Anyone, through a form. **Chosen.**
- C) Active members only.
