# 0015 — MailerLite is the newsletter tool; public signup is built in Launch 1

Status: Accepted (Parker, 2026-11-27, Q-20261127-173323-16800). Confirmed on Discord 2026-11-28.

## Decision

- **Newsletter tool: MailerLite.** This settles the open question in decision 0007 (Zeffy's email tool
  vs MailerLite). The MailerLite work (E-3, E-4) comes off hold as far as this needs it.
- **Public newsletter signup, built now (Launch 1, not Launch 2).** The "Get the blog in your inbox"
  box from the approved concept adds a visitor to a MailerLite "Newsletter" group, using MailerLite's
  own double opt-in (MailerLite sends the confirmation email).
- Parker approved building it now; it isn't in the original backlog.

Rules:
- The MailerLite API key is set only by a human, only in Netlify. The factory builds and tests against
  mocks and fixtures. The box stays hidden while the key isn't set.
- No third-party script on the site; the signup goes through our server.
