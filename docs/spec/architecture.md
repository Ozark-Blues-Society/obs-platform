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
     Sanity CMS  Supabase   Stripe   Resend / MailerLite
     (content)   (auth, DB,  (dues,   (transactional /
                 storage)    portal)   newsletters)      + Zeffy donation embed
```

## Repo layout (target)

```
app/(site)/...        public pages, events, blog, classifieds, sponsors, donate
app/(site)/account/   My Account, my listings (in the site layout, for its header and footer)
app/admin/...         members, moderation (role-gated)
app/studio/[[...]]    Sanity Studio
app/api/stripe/webhook
app/api/cron/...      scheduled jobs (or Supabase pg_cron)
sanity/schemas/...    page, event, venue, post, sponsor, directoryEntry, person, siteSettings
supabase/migrations/  tables, RLS policies, functions
supabase/tests/       RLS tests (pgTAP)
emails/...            React Email templates
scripts/fixtures/     synthetic members, events, listings
scripts/import/       ClubExpress CSV importer (dry-run first)
docs/                 specs, decisions, volunteer guide
```

## Content (Sanity)

- **page**: title, slug, template (directory | spotlight | promo | standard), visibility (everyone | members | levels[]), menu placement, blocks[] (hero, text, image, video, upcomingEvents, sponsorStrip, table, button, quote, form)
- **event**: title, start date/time, recurrence (none | weekly | monthly + until), venue → venue, category, price text, memberPrice, membersOnly, image (hotspot), body
- **venue**: name, address, map link
- **post**: title, slug, cover, category, author, excerpt, body (Portable Text), membersOnly, includeInDigest, publishedAt
- **sponsor**: name, url, logo, tier, featured (only one at a time — enforce with validation/action), blurb, endsAt
- **person** (board), **siteSettings** (menus, footer, benefits text, social links)
- Members-only bodies follow `docs/decisions/0001-members-only-storage.md`.

## People and money (Supabase)

```
profiles      id (auth.users), first_name, last_name, email, phone, level, status (active|expiring|lapsed),
              expires_at, auto_renew, stripe_customer_id, joined_at, notes
payments      id, profile_id, kind (stripe|check|cash|import), amount, paid_at, stripe_ref, recorded_by
user_roles    profile_id, role (admin|membership_manager|moderator|editor)
listings      id, profile_id, category, title, body, price, photo_path, contact_pref,
              status (pending|live|rejected|expired), reject_reason, created_at, approved_at, expires_at
listing_messages id, listing_id, sender_id, sent_at              -- daily limit on messages to posters (K-3)
gated_content id, slug, title, body, levels[]                 -- if decision 0001 picks option B
stripe_events id, type, received_at                           -- webhook idempotency
```

RLS: a member reads/updates only their own profile (never their own level/status/expires_at). Live
listings are public; owners manage their own; moderators update status. Admin views check user_roles.
Every policy gets a test. Functions that policies and triggers call live in the `private` schema,
which the Data API doesn't expose.

No households: the board created no family memberships (`board-decisions.md` §2).

## Stripe → Supabase (webhook, signature-verified, idempotent)

| Event | Action |
| --- | --- |
| checkout.session.completed | link customer ↔ profile; one-time payment → expires_at = max(now, expires_at) + 1 year |
| invoice.paid | extend expires_at, status active, insert payment |
| customer.subscription.updated / deleted | update auto_renew |
| invoice.payment_failed | flag member, email a link to the Customer Portal |

## Scheduled jobs (daily)

Renewal reminders at −30 and −7 days (members not on auto-renew; Stripe emails auto-renewers) ·
lapse at expiry, win-back email at +14 days · expire listings at 60 days, reminder at −5 days ·
MailerLite group sync (also on status changes).

## Known gotchas

- Configure Resend as Supabase Auth SMTP (the built-in SMTP is heavily rate-limited).
- Resend free tier: 100 emails/day. Launch-day magic links need a paid month (human gate).
- Supabase free tier pauses after a week of inactivity and has no backups; production uses Pro.
- Stripe Billing adds 0.7% on subscriptions; offer one-time "pay for a year" too.
