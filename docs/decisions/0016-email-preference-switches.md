# 0016 — Two email switches on My Account

Status: Accepted (Parker, 2026-11-27, Q-20261127-174756-24341, option B). Confirmed on Discord 2026-11-28.

## Decision

My Account shows two switches, as in the approved concept: **Monthly newsletter** and **Event
announcements**. Each one is a MailerLite group the member joins or leaves.

- MailerLite is the only record, so the switches and MailerLite's unsubscribe links always agree (the
  page reads the member's state from MailerLite).
- Built now, together with the newsletter signup (decision 0015). Hidden while the MailerLite key isn't
  set.
- Site emails about the member's own membership or listing (sign-in, welcome, receipts, reminders,
  lapsed notice, listing emails) have no switch.
- The newsletter writer's guide must say that each campaign goes to the matching group.
