# Backlog

The Mayor turns this file into beads (work items) with the dependencies shown. Each item lists its
acceptance criteria. 🧑 marks a human gate; file it with `tools/ask-human.sh` and don't build past it.

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
- **M-3 Stripe products/prices** in test mode from `board-decisions.md` (yearly subscription + one-time
  per level). Script to (re)create them idempotently. *Needs board decision #1.*
- **M-4 Join & checkout:** level picker (benefits page), Stripe Checkout, success → My Account.
- **M-5 Webhook handler** per architecture table; idempotent; unit + integration tests with Stripe CLI.
- **M-6 Customer Portal** link from My Account.
- **M-7 Gating:** middleware/server checks for members-only pages, posts, events and files, per
  decision 0001; e2e tests for visitor vs member vs wrong level.
- **M-8 My Account:** status, renewal date, perks, profile + email preferences, my listings.
- **M-9 Level-gated venue directory:** names/details for all members; booking contacts for Band,
  Business and Sponsor only (board decisions §1). Tests prove Individual members and the public can't
  read contacts through any API. (No family memberships: the board created none.)

## A — Admin

- **A-1 Members screen:** search, filter by status/level, totals, CSV export, record check/cash payment.
- **A-2 Roles management** for administrators.
- **A-3 Moderation queue** (with K-1).

## K — Classifieds

- **K-1 Submit listing** (members, photo upload to Storage), pending status.
- **K-2 Moderation** approve/reject with reason; emails to poster.
- **K-3 Public listings** (viewing is public; posting needs an active membership) with category filters
  for Musicians Wanted, Gear, Merch, Street Team, Member Connect; contact poster via site (email stays
  private).
- **K-4 Expiry** after 60 days, reminder at −5 days, renew flow; "My listings".

## E — Email

- **E-1 React Email templates:** welcome, receipt, renewal −30/−7, lapsed +14, listing approved /
  rejected / expiring, volunteer signup. Branded.
- **E-2 Scheduled jobs** for reminders, lapses, expiries (idempotent; tests with fake clock).
- **E-3 MailerLite sync** (test account): groups active/expiring/lapsed/per level; on change + nightly.
- **E-4 Newsletter template** in MailerLite style matching the brand; monthly digest content export.
- **E-5 Email authentication guide** (SPF/DKIM/DMARC records to add) — applying them is 🧑 (DNS).

## G — Migration

- **G-1 ClubExpress importer:** CSV → profiles/payments(import) keeping expires_at; mapping config;
  dry-run report; idempotent. Built and tested on synthetic CSV only.
- **G-2 🧑 Real import rehearsal** — only with Parker's approval, in an approved environment.

## Q — Quality and launch prep

- **Q-1 Accessibility pass** (axe in Playwright + manual checklist).
- **Q-2 Performance pass** (Lighthouse ≥ 90 on home, events, blog).
- **Q-3 Security review:** RLS policies, webhook verification, role checks, dependency audit.
- **Q-4 Volunteer guide** (`docs/volunteer-guide/`) with screenshots: editors, admins, treasurer.
- **Q-5 Launch runbook:** production env checklist, DNS steps, Stripe live switch, rollback.
  Executing it is 🧑.
