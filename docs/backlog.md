# Backlog

The Mayor turns this file into beads (work items) with the dependencies shown. Each item lists its
acceptance criteria. 🧑 marks a human gate; file it with `tools/ask-human.sh` and don't build past it.

**Priority (decision 0002):** label every bead `launch-1` or `launch-2` and work `launch-1` first.
Launch 1 = F-*, D-*, C-*, P-*, M-1 to M-8, A-1, A-2, E-1 (welcome only: Zeffy sends the receipts,
decision 0007), E-5 (Resend records only, decision 0004), G-1, Z-1, Z-3, Z-4, Q-1 to Q-3, Q-5.
Launch 2 = K-* (classifieds, incl. A-3), N-* (gig submission), E-1 (remaining), E-2 to E-4, E-5
(MailerLite records and DMARC), G-2 if deferred, Z-2, Z-5, Q-4. Launch 2 work may run in parallel
when it doesn't slow Launch 1.

## F — Foundation (start here)

- **F-1 Scaffold the app.** Next.js App Router + TypeScript strict + Tailwind + pnpm. ESLint, Prettier,
  Vitest, Playwright. Scripts: dev, build, lint, typecheck, test, test:e2e. README with setup steps.
  *Done when* a fresh clone runs `pnpm i && pnpm build && pnpm test` green.
- **F-2 CI.** GitHub Actions on PRs to develop/main: lint, typecheck, unit tests, build, Playwright
  (against local Supabase in the runner). *Needs F-1.*
- **F-3 Local Supabase.** `supabase init`, migrations folder, seed script with synthetic fixtures
  (40 members across levels/statuses, events, listings). pgTAP test harness. *Needs F-1.*
- **F-4 Environment config.** Typed env validation (zod), `.env.example` listing every key, no secrets
  committed. *Needs F-1.*
- **F-5 Sanity Studio.** Embedded at `/studio` on the development dataset; preview/Presentation wired.
  *Needs F-1.*
- **F-6 Decision 0001** (members-only storage): verify Sanity pricing, then 🧑 ask Parker to choose.

## D — Design system

- **D-1 Tokens and type** from `docs/design/prototype.html`: colors, DM Serif Display + Inter,
  spacing, radii, light theme. *Needs F-1.*
- **D-2 Layout shell:** header with nav + mobile menu, footer, page header, Sign in / Join / My Account
  states. *Needs D-1.*
- **D-3 Components:** Button, Card, Tag, Pill filters, Table, Form fields, Modal, Toast, Lock overlay,
  event card, post card, sponsor logo. Storybook-free; a `/dev/components` page (dev only).
- **D-4 🧑 Design Approval package:** home page + Directory, Band Spotlight, Promo Feature, Standard
  templates with real Society branding (from the file portal), deployed to a preview URL. Ask Parker
  for approval (contract milestone). Allow two revision rounds.

## C — Content model (Sanity)

- **C-1 Schemas** per `docs/spec/architecture.md`: page + blocks, event + venue (recurrence), post,
  sponsor (single-featured rule, endsAt), person, siteSettings. Validation and helpful field descriptions
  written for volunteers. *Needs F-5.*
- **C-2 Page template renderer**: blocks → components, the four templates. *Needs C-1, D-3.*

## P — Public site

- **P-1 Home:** hero, next event, upcoming events, latest posts, sponsor band, membership call to action.
- **P-2 Events:** month grid + list, category filters, detail page, recurrence expansion, member price
  display, members-only handling, add-to-calendar, ICS feed route. Tests for recurrence.
- **P-3 Blog:** list with category filter, post page, members-only lock, scheduling.
- **P-4 Sponsors:** tiers, featured spotlight, auto-hide after endsAt.
- **P-5 About & Volunteer:** pages + volunteer form → email to coordinator (Resend test mode).
- **P-6 Donate:** Zeffy embed placeholder (real form ID is a 🧑 item), impact copy block.
- **P-7 Contact, privacy, terms** (template text marked "for client review" — 🧑 legal text gate), 404,
  sitemap, metadata/OpenGraph, redirects map file for old URLs.

## M — Members and dues

- **M-1 Auth:** Supabase email-link + password sign-in, sign-out, Resend as Auth SMTP. *Needs F-3.*
- **M-2 Profiles, households, roles** tables + RLS + pgTAP tests (member can't read others; moderator
  can't read profiles). *Needs M-1.*
- **M-3 Zeffy client and level mapping** (decision 0007): the dated Public API spec snapshot at
  `docs/vendor/zeffy-openapi-2026-11-27.json`; a typed client built against it (bearer auth, cursor
  pagination, 429 backoff with `Retry-After`, the error envelope), tested with fixtures from the
  snapshot; `ZEFFY_API_KEY` and `ZEFFY_WEBHOOK_SECRET` as optional server-only env values; a
  level-mapping table (Zeffy `campaign_id` + `rate_id` → level) that administrators can edit, seeded
  from config. Removes Stripe from `.env.example` and the env schema.
- **M-4 Join page with the Zeffy form:** the four levels and their benefits from data, "Pay with the
  same email you sign in with", and "Join" opening the Zeffy membership form with the level picked
  (embedded if Zeffy allows it, otherwise a link); a thank-you page at `/join/thanks` polls the
  member's status for about 60 seconds, then says "We'll email you as soon as it's confirmed."
  *Needs M-3.*
- **M-5 Zeffy webhook, nightly reconciliation and admin review list** per architecture ("Zeffy →
  Supabase"): signature-verified, idempotent `POST /api/zeffy/webhook`; membership payments become
  membership periods (a new member gets a profile and the welcome email); refunds, lost disputes,
  rates missing from the mapping and payments it can't match go to an admin review list; a step in
  the daily job pulls recent payments so missed webhooks heal. Tests with signed fixtures.
  *Needs M-3.*
- **M-6 Auto-renew status and "Manage payment" link:** My Account shows auto-renew on/off from the
  latest payment's `recurring.status`, with a link to Zeffy to manage the card or auto-renew (🧑 the
  exact URL, confirmed with the Society's Zeffy account; until then, Zeffy's donor help page).
  *Needs M-5.*
- **M-7 Gating:** middleware/server checks for members-only pages, posts, events and files, per
  decision 0001; e2e tests for visitor vs member vs wrong level.
- **M-8 My Account:** status, renewal date, perks, profile + email preferences, my listings.
- **M-9 Level-gated venue directory:** names/details for all members; booking contacts for Band,
  Business and Sponsor only (board decisions §1). Tests prove Individual members and the public can't
  read contacts through any API. (No family memberships: the board created none.)

## A — Admin

- **A-1 Members screen:** search, filter by status/level, totals, CSV export, record check/cash payment.
  A recorded payment is also written to Zeffy (`POST /api/v1/payments`); when Zeffy refuses it, it is
  flagged "not in Zeffy yet" and retried nightly (decision 0007). *Needs M-3.*
- **A-2 Roles management** for administrators.
- **A-3 Moderation queue** (with K-1).

## K — Classifieds

- **K-1 Submit listing** (members, photo upload to Storage), pending status.
- **K-2 Moderation** approve/reject with reason; emails to poster.
- **K-3 Public listings** (viewing is public; posting needs an active membership) with category filters
  for Musicians Wanted, Gear, Merch, Street Team, Member Connect; contact poster via site (email stays
  private).
- **K-4 Expiry** after 60 days, reminder at −5 days, renew flow; "My listings".

## N — Member gig submission (decision 0003, Launch 2)

- **N-1 Submission form** in My Account for Band/Business/Sponsor (server-side level check), creating a
  Sanity draft event (+ draft venue if new) with submittedBy and submissionStatus: pending.
- **N-2 Editor workflow:** Studio "Member submissions" list; editor email on new submission; publish or
  decline updates the member's view.
- **N-3 My submissions** list in My Account with status; limits (5 pending, rate limit, image limits);
  tests for level checks and drafts staying unpublished.

## Z — Zeffy ticket sales (decision 0007)

A complimentary add-on (`docs/spec/scope.md`), plus the Zeffy contact sync. Z-1, Z-3 and Z-4 are
Launch 1; Z-2 and Z-5 are Launch 2.

- **Z-1 Event ↔ Zeffy campaign link:** an optional `zeffyCampaign` field on the Sanity event (campaign
  id + url), with a Studio input that lists the Society's Zeffy ticketing campaigns (a server route
  calling `GET /campaigns`) to pick from. *Needs M-3, C-1.*
- **Z-2 Import from Zeffy:** an action creates *draft* events from ticketing campaigns that aren't
  linked yet (title, description, dates from `occurrences`, Zeffy url); an editor adds the venue and
  category, then publishes. *Needs M-3, C-1.*
- **Z-3 Buy tickets:** event pages with a linked campaign show "Buy tickets" (the Zeffy url, or an
  embed) and the ticket prices from `rates[]`, cached and revalidated. No availability: `seats` is
  capacity, not tickets left. *Needs M-3, C-1.*
- **Z-4 Contact upsert:** when a member joins or edits their profile, `PUT /api/v1/contacts` (upsert
  by email: name, phone, address), so Zeffy's records and email tool match.
- **Z-5 My tickets** in My Account, from the payments by the member's contact with
  `campaign_type = ticketing`.

## E — Email

- **E-1 React Email templates:** welcome, receipt, renewal −30/−7, lapsed +14, listing approved /
  rejected / expiring, volunteer signup. Branded. Decision 0007 drops the receipt: Zeffy sends receipts.
- **E-2 Scheduled jobs** for reminders, lapses, expiries (idempotent; tests with fake clock). Decision
  0007: a site setting, "Zeffy sends renewal reminders", turns the −30/−7 reminders off so members
  don't get both; while it's off, members on auto-renew get them too.
- **E-3 MailerLite sync** (test account): groups active/expiring/lapsed/per level; on change + nightly.
- **E-4 Newsletter template** in MailerLite style matching the brand; monthly digest content export.
  E-3 and E-4 stay in place but on hold (decision 0007): which newsletter tool the Society uses
  (Zeffy's email tool or MailerLite) is a 🧑 question, asked later.
- **E-5 Email authentication guide** (SPF/DKIM/DMARC records to add) — applying them is 🧑 (DNS).
  Split by decision 0004: the Resend records are Launch 1, in
  [`docs/launch/resend-dns-records.md`](launch/resend-dns-records.md); the MailerLite records and
  DMARC stay Launch 2, in
  [`docs/launch/mailerlite-and-dmarc-dns-records.md`](launch/mailerlite-and-dmarc-dns-records.md).

## G — Migration

- **G-1 ClubExpress importer:** CSV → profiles/payments(import) keeping expires_at; mapping config;
  dry-run report; idempotent. Built and tested on synthetic CSV only. *Needs M-5.*
- **G-2 🧑 Real import rehearsal** — only with Parker's approval, in an approved environment.

## Q — Quality and launch prep

- **Q-1 Accessibility pass** (axe in Playwright + manual checklist).
- **Q-2 Performance pass** (Lighthouse ≥ 90 on home, events, blog).
- **Q-3 Security review:** RLS policies, webhook verification, role checks, dependency audit.
- **Q-4 Volunteer guide** (`docs/volunteer-guide/`) with screenshots: editors, admins, treasurer.
- **Q-5 Launch runbook:** production env checklist (the Zeffy keys go on Netlify only), DNS steps, the
  Zeffy live check (one real membership payment on staging, then a refund, decision 0007), rollback.
  Executing it is 🧑.
