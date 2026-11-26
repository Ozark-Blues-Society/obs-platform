# 0002 — Soft launch by December 11, full scope after

Status: Accepted (Parker, 2026-11-26)

## Decision

Launch a reduced but solid **Launch 1** on or before **2026-12-11**, then ship the rest as **Launch 2**
on the contract timeline or sooner. The factory keeps building around the clock; Launch 2 work continues
in parallel whenever it doesn't slow Launch 1. Every bead is labeled `launch-1` or `launch-2`.

Quality bars do not drop for Launch 1: RLS tests, CI green, accessibility baseline, no production
secrets on the factory server. Ship less, not worse.

## Launch 1 (must work on day one)

| Area | Included |
| --- | --- |
| Public site | Home, events calendar (view; members-only events gated), blog, sponsors (single tier), About & Volunteer form, Donate (Zeffy embed), Contact, privacy & terms (client-reviewed), 404, SEO basics, redirects from old URLs |
| Membership | Join and renew via Stripe Checkout for all four levels; email-link + password sign-in; My Account (status, renewal date, benefits, perk codes, Stripe Customer Portal link) |
| Members-only | Venue directory with level-gated booking contacts; members-only pages and posts |
| Admin | Member list (search, filters, CSV export), record check/cash payments, roles |
| Content Studio | Editors can manage pages, events, posts, sponsors, venues, site settings |
| Email | Sign-in emails, welcome email, payment receipts (Stripe) |
| Migration | Import current ClubExpress members keeping expiration dates **if the export arrives by Dec 4**; otherwise ClubExpress keeps running until Launch 2 |

## Launch 2 (follows)

Musician classifieds + moderation · member gig submission (decision 0003) · renewal / lapsed / listing
emails · MailerLite group sync + newsletter template · migration (if deferred) · polish beyond the
accessibility/performance baseline · volunteer guide completion.

## Critical path (human, not agent, work)

| Needed by | Item |
| --- | --- |
| Dec 1 | Stripe account created and verification started (bank + identity checks take days) |
| Dec 2 | Design Approval (home + templates) — compressed review window |
| Dec 3 | Production accounts: Supabase, Sanity, Netlify, Resend (Society-owned) |
| Dec 4 | Content: logo, photos, About/mission, board list, volunteer roles, events, venues, sponsors; ClubExpress export |
| Dec 8 | Domain/DNS access (GoDaddy call with Diane) |
| Dec 9 | Content freeze; launch rehearsal on staging |
| Dec 10–11 | Launch (human gate) |

If a critical-path item slips, agents keep building on placeholders and test mode; the launch date is
re-decided by Parker, never silently.
