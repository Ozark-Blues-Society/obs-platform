# Architecture

```
                 Visitors & members
                        │
        ┌───────────────▼────────────────┐
        │  Next.js app (App Router, TS)  │  Netlify (Vercel Pro fallback)
        │  /(site)    public pages       │
        │  /account   My Account         │
        │  /admin     members, moderation│
        │  /studio    embedded Sanity    │
        │  /api/*     webhooks, cron     │
        └──┬─────────┬─────────┬────────┬┘
           │         │         │        │
     Sanity CMS  Supabase    Zeffy   Resend / MailerLite
     (content)   (auth, DB,  (dues,   (transactional /
                 storage)    tickets,  newsletters)
                             donations)
```

## Repo layout (target)

```
app/(site)/...        public pages, events, blog, classifieds, sponsors, donate
app/(site)/account/   My Account, my listings (in the site layout, for its header and footer)
app/admin/...         members, moderation (role-gated)
app/studio/[[...]]    Sanity Studio
app/api/zeffy/webhook
app/api/cron/...      scheduled jobs (or Supabase pg_cron)
sanity/schemas/...    page, event, venue, post, sponsor, directoryEntry, person, siteSettings
supabase/migrations/  tables, RLS policies, functions
supabase/tests/       RLS tests (pgTAP)
emails/...            React Email templates
scripts/fixtures/     synthetic members, events, listings
scripts/import/       ClubExpress CSV importer (dry-run first)
docs/                 specs, decisions, volunteer guide, vendor API snapshots (docs/vendor/)
```

## Content (Sanity)

- **page**: title, slug, template (directory | spotlight | promo | standard), visibility (everyone | members | levels[]), menu placement, blocks[] (hero, text, image, video, upcomingEvents, sponsorStrip, table, button, quote, form)
- **event**: title, start date/time, recurrence (none | weekly | monthly + until), venue → venue, category, price text, memberPrice, membersOnly, image (hotspot), body, zeffyCampaign (Zeffy ticketing campaign id + url, decision 0007)
- **venue**: name, address, map link
- **post**: title, slug, cover, category, author, excerpt, body (Portable Text), membersOnly, includeInDigest, publishedAt
- **sponsor**: name, url, logo, tier, featured (only one at a time — enforce with validation/action), blurb, endsAt
- **person** (board), **siteSettings** (menus, footer, benefits text, social links, "Zeffy sends renewal reminders")
- Members-only bodies follow `docs/decisions/0001-members-only-storage.md`.

## People and money (Supabase)

```
profiles      id (auth.users), first_name, last_name, email, phone, level, status (active|expiring|lapsed),
              expires_at, auto_renew, joined_at, notes
payments      id, profile_id, kind (zeffy|check|cash|import), amount, paid_at, level, period_end,
              zeffy_payment_id, in_zeffy (check/cash: false until Zeffy accepts it), review_reason,
              recorded_by
user_roles    profile_id, role (admin|membership_manager|moderator|editor)
listings      id, profile_id, category, title, body, price, photo_path, contact_pref,
              status (pending|live|rejected|expired), reject_reason, created_at, approved_at, expires_at
gated_content id, slug, title, body, levels[]                 -- if decision 0001 picks option B
zeffy_events  id (Zeffy's event id), type, payload, received_at, processed_at   -- webhook idempotency
zeffy_rates   campaign_id, rate_id, level                     -- level mapping, administrators edit it
```

RLS: a member reads/updates only their own profile (never their own level/status/expires_at). Live
listings are public; owners manage their own; moderators update status. Admin views check user_roles.
Every policy gets a test. Functions that policies and triggers call live in the `private` schema,
which the Data API doesn't expose.

No households: the board created no family memberships (`board-decisions.md` §2).

## Zeffy → Supabase (decision 0007)

Zeffy takes the payments: one membership form with the four levels as rates and yearly auto-renew,
ticketing campaigns, and the donation form (P-6). It sends the receipts, and members update their card
or cancel auto-renew there. **Supabase stays the source of truth for who is a member and until when.**
Zeffy's API can't start a checkout, create a membership, send the payer back to our site or carry
metadata, so payments are matched to members by the buyer's email. It has no test mode: tests use
fixtures from the spec snapshot (`docs/vendor/zeffy-openapi-2026-11-27.json`) and dummy `whsec_`
secrets. `ZEFFY_API_KEY` and `ZEFFY_WEBHOOK_SECRET` are optional server-only values that a human sets
on Netlify staging and production only, never on the factory server or in CI. Live verification
(one real payment on staging, then a refund) is a 🧑 gate.

**Webhook** (`POST /api/zeffy/webhook`, signature-verified, idempotent): checks
`Zeffy-Signature: t=<unix>,v1=<hex>`, an HMAC-SHA256 over `{t}.{rawBody}` with the `whsec_` secret
(constant-time compare; anything older than 5 minutes is rejected), stores the event by its id
(Zeffy retries for up to 3 days with the same id) and answers 2xx at once. Events are processed from
the store.

| Event | Action |
| --- | --- |
| payment.completed with `campaign_category` membership | match `buyer.email` to a profile (case-insensitive), or create the profile and send the welcome email with a sign-in link; insert the payment; set level and expires_at (rules below) and auto_renew from `recurring.status`; a rate missing from the mapping goes to the admin review list |
| payment.updated / payment.deleted | carries the id only: re-fetch the payment; a full refund or a lost dispute flags the period for admin review (access is not removed automatically) |

**Membership period:** the level comes from the mapping (`campaign_id` + `rate_id`). A member who
renews before expiry gets expires_at + 1 year, which keeps the join anniversary (board decisions §3);
otherwise the payment date + 1 year. `recurring.current_period_end` wins when present and later. No
grace period (§4).

**Nightly reconciliation** (a step in the daily job, decision 0006): `GET /api/v1/payments` created
since the last run, with a 2-day overlap, upserted through the same rules, so missed webhooks heal
themselves.

**Check/cash** (A-1): an admin records the payment in OBS; the platform then writes it to Zeffy
(`POST /api/v1/payments`: cash or cheque, the membership campaign, the mapped rate), so Zeffy stays the
Society's single ledger. If Zeffy refuses (e.g. `403 organization_not_verified`), the local record is
flagged "not in Zeffy yet" and retried nightly.

**Contacts** (Z-4): when a member joins or edits their profile, `PUT /api/v1/contacts` (an upsert by
email: name, phone, address).

**Join** (M-4): the Join page shows the levels (board decisions §1) and asks people to sign in first
("Pay with the same email you sign in with"). "Join" opens the Zeffy membership form with the level
picked (embedded if Zeffy allows it, otherwise a link). `/join/thanks` polls the member's status for
about 60 seconds, then says "We'll email you as soon as it's confirmed."

**My Account** (M-6, M-8): level, expiry, auto-renew on/off from the latest payment's
`recurring.status`, and a "Manage payment or auto-renew" link to Zeffy (the exact URL is a 🧑 item;
until it's confirmed, Zeffy's donor help page).

**Tickets** (Z-1 to Z-5, a complimentary add-on): an event links a Zeffy ticketing campaign
(`zeffyCampaign`), picked in the Studio from `GET /api/v1/campaigns`; editors can import unlinked
campaigns as draft events; event pages show "Buy tickets" and the prices from `rates[]`, never
availability (`seats` is capacity, not tickets left); My Account lists the member's tickets.

## Scheduled jobs (daily)

Renewal reminders at −30 and −7 days for every member, unless the site setting "Zeffy sends renewal
reminders" is on (then Zeffy's replace ours, decision 0007); a member on auto-renew is told the
membership renews by itself on that date, with the "Manage payment or auto-renew" link, and isn't
asked to pay · lapse at expiry, lapsed note at +14 days (decision 0013) · Zeffy payment
reconciliation and check/cash retries · expire listings at 60 days, reminder at −5 days · MailerLite
group sync (also on status changes).

## Known gotchas

- Configure Resend as Supabase Auth SMTP (the built-in SMTP is heavily rate-limited).
- Resend free tier: 100 emails/day. Launch-day magic links need a paid month (human gate).
- Supabase free tier pauses after a week of inactivity and has no backups; production uses Pro.
- Zeffy has no sandbox, and its API refuses writes (`403 organization_not_verified`) until the
  Society finishes Zeffy's Stripe verification. It allows 100 requests a minute and 20 a second per
  organization; on 429, wait for `Retry-After`. Pages are cursor-based (`limit` up to 100,
  `starting_after`, `has_more`, `next_cursor`).
- Zeffy's `payment.updated`, `payment.deleted`, `contact.updated` and `contact.deleted` webhooks carry
  only an id: re-fetch the record.
