# 0007 — Zeffy for memberships, tickets and donations; Stripe only where needed

- **Status:** Accepted (Parker, 2026-11-27)
- **Supersedes:** the Stripe parts of `docs/spec/architecture.md` and backlog M-3 to M-6
- **Contract:** Exhibit A names Stripe. Parker handles a no-cost change note with the board.

## Why

Zeffy is free for nonprofits: no processing fees, with an optional tip from the payer. The Society
already uses it for donations. Stripe would cost about 3.6% + 30¢ per membership. Parker's goal is
to use Zeffy wherever it is feasible, while the OBS platform stays the one place members and
volunteers do their work.

A Stripe account will still be created. It is used only where a later decision says Zeffy can't do
the job, or where the Society asks for it. No Stripe code paths in Launch 1.

## What Zeffy's API can and can't do

Source: the Public API v1 spec, `https://api.zeffy.com/api/docs/openapi.json`, read 2026-11-27.
Save a dated snapshot at `docs/vendor/zeffy-openapi-2026-11-27.json` and build against that.

- **Auth:** `Authorization: Bearer <org API key>`. There are no scopes and no sandbox or test mode.
  Writes return `403 organization_not_verified` until the org finishes Zeffy's Stripe verification.
- **Rate limits:** 100 requests a minute and 20 a second per org. On 429, honor `Retry-After`.
- **Pagination:** cursor-based, using `limit` (1–100), `starting_after`, `has_more` and `next_cursor`.
- **Payments:** `GET /api/v1/payments` takes filters for contact, campaign, type, status and created
  date. `GET /api/v1/payments/{id}`. `POST /api/v1/payments` records an *offline* payment (cash,
  cheque, in_kind or other) on a donation or ticketing campaign. `DELETE` works only on
  manual/imported payments. A payment carries `buyer.email`, `campaign_id`, `campaign_category`
  (which includes `membership`), `items[].rate_id`/`rate_title`, `recurring{is_recurring, status,
  interval, current_period_start, current_period_end}`, `refund_status`, `dispute`, `discount` and
  `receipt_url`.
- **Contacts:** full CRUD. `PUT /api/v1/contacts` is an upsert keyed by email. There are no tags,
  lists or external-ID fields.
- **Campaigns:** read-only. `GET /api/v1/campaigns` and `GET /api/v1/campaigns/{id}` return `type`
  (`donation_form`/`ticketing`), `category`, `title`, `description`, `url`, `start_date`/`end_date`,
  `occurrences[]` and `rates[]`.
- **Webhooks** (set up in Zeffy's dashboard): `payment.completed` and `payment.created` carry the
  full Payment. `payment.updated` and `payment.deleted` carry the id only, so re-fetch the payment.
  `contact.created` carries the full Contact; `contact.updated` and `contact.deleted` carry the id only.
  - Each POST includes `Zeffy-Signature: t=<unix>,v1=<hex>`, where `v1` is HMAC-SHA256 over
    `"{t}.{rawBody}"` using the `whsec_` secret. Reject anything older than 5 minutes, and compare in
    constant time.
  - Failed deliveries are retried for up to 3 days (12 attempts). The event `id` stays the same
    across retries, so use it as the idempotency key.
- **Not available through the API:** starting a checkout, creating a membership or subscription,
  redirecting back to our site after payment, metadata or external IDs, membership status or expiry
  fields, sending email, managing lists, creating campaigns or events, refunds, discount-code
  management, and member login.
- **Zeffy's MCP connector is read-only.** It's for people asking questions about their data. The
  platform doesn't use it.

## The split

| Zeffy does | The OBS platform does |
| --- | --- |
| Takes membership payments: one membership form with the 4 levels as rates, yearly auto-renew. Embedded or linked from our Join page. | Sign-in, My Account, members-only gating, member list and export, roles. **Supabase stays the source of truth for who is a member and until when.** |
| Receipts (and optionally renewal reminders; see Email). | Turns each Zeffy membership payment into a membership period: webhook plus nightly reconciliation. |
| Ticket sales: ticketing campaigns created in Zeffy's dashboard. | Calendar. Imports or links Zeffy ticket sales to events. "Buy tickets" on event pages. |
| Donations (embedded donation form, P-6). | Admin screens: record check/cash (written to Zeffy too), unmatched or refunded payments, links to the right Zeffy pages. |
| Card updates and cancelling auto-renew. | My Account shows auto-renew status and a "Manage payment" link to Zeffy. |
| Sponsor and member discount codes (created in Zeffy). | Shows perk codes on My Account. |

## How to build it

**Secrets.** Add `ZEFFY_API_KEY` and `ZEFFY_WEBHOOK_SECRET` to the env schema as optional,
server-only values. A human sets them only in Netlify staging/production. They never go on the
factory server or in CI.

**API client.** A typed client covering auth, cursor pagination, 429 backoff and the error
envelope, with fixtures from the spec snapshot. Tests run against fixtures and dummy `whsec_` secrets.

**Level mapping.** A table that maps Zeffy `campaign_id` + `rate_id` to a membership level. It is
editable by administrators and seeded from config. If a payment's rate isn't mapped, it goes to the
admin review list.

**Join flow (M-4).**
1. The Join page shows the levels from board decisions §1.
2. Encourage signing in first: "Pay with the same email you sign in with."
3. "Join" opens the Zeffy membership form (embed if Zeffy's embed allows it, otherwise a link) with
   the level picked.
4. A thank-you page at `/join/thanks` polls the member's status for about 60 seconds, then shows "We'll
   email you as soon as it's confirmed."

**Webhook (M-5).**
- `POST /api/zeffy/webhook`: verify the signature, store the event by id (idempotent), and return 2xx
  fast. Process from the stored events.
- **`payment.completed`** with `campaign_category = membership` → match `buyer.email` to a profile
  (case-insensitive). If none exists, create the profile and send a welcome email with a sign-in link.
- **Membership period:**
  - Level comes from the mapping.
  - If the member is renewing before expiry, the new expiry is the current expiry plus 1 year. That
    keeps the board's join-anniversary rule.
  - Otherwise, the new expiry is the payment date plus 1 year.
  - When `recurring.current_period_end` is present and later, use it.
  - No grace period (board decisions §4).
- **`payment.updated` / `payment.deleted`** → re-fetch the payment. A full refund or a lost dispute
  flags the period for admin review. Access is not removed automatically.

**Nightly reconciliation.** Add a step to the existing daily job (decision 0006). It pulls
`GET /api/v1/payments` created since the last run, with a 2-day overlap, upserts, and applies the same
rules, so missed webhooks heal themselves.

**Check/cash (A-1).** An admin records the payment in OBS. The platform then calls
`POST /api/v1/payments` (`payment_method` cash/cheque, membership campaign, the mapped rate) so Zeffy
stays the Society's single ledger. If Zeffy refuses (for example
`403 organization_not_verified`), keep the local record flagged "not in Zeffy yet" and retry nightly.

**Contacts.** When a member joins or edits their profile, call `PUT /api/v1/contacts` (upsert by
email: name, phone, address) so Zeffy's records and email tool match.

**My Account (M-6, M-8).** Show the level, the expiry, and auto-renew on/off from the latest payment's
`recurring.status`. Add a "Manage payment or auto-renew" link to Zeffy's page. The exact URL is a 🧑
item to confirm with the Society's Zeffy account. Until then, link to Zeffy's donor help page.

**Events and tickets (new Z-items; complimentary add-on, like 0003).**
- **Z-1:** Sanity event gets an optional `zeffyCampaign` field (campaign id + url). A Studio input
  lists the Society's Zeffy ticketing campaigns (server route calling `GET /campaigns`) to pick from.
- **Z-2:** An "Import from Zeffy" action creates *draft* Sanity events from ticketing campaigns that
  aren't linked yet (title, description, dates from `occurrences`, Zeffy url). An editor adds the
  venue and category, then publishes.
- **Z-3:** Event pages with a linked campaign show "Buy tickets" (Zeffy url, or embed) and the
  ticket prices from `rates[]` (cached and revalidated). Don't show availability: `seats` is
  capacity, not tickets left.
- **Z-4:** Contact upsert (above).
- **Z-5 (Launch 2):** "My tickets" in My Account, from payments by the member's contact with
  `campaign_type = ticketing`.

**Email.**
- Zeffy sends payment receipts. Our receipt email is dropped.
- We keep the contract's welcome, renewal −30/−7 and lapsed +14 emails. Add a site setting, "Zeffy
  sends renewal reminders", that turns ours off if the Society prefers Zeffy's, so there are no
  duplicates.
- Zeffy has no email or list API. The MailerLite work (E-3/E-4) stays in place but on hold. Newsletter
  tool (Zeffy's email tool vs MailerLite) is a 🧑 question for the Society. Ask it later, not now.

**Stripe.** Close PR #54 (M-3 Stripe products) without merging. Keep the branch. Remove Stripe from
`.env.example` and the env schema unless something still uses it.

**Live verification is a 🧑 human gate.** On staging, with the Society's Zeffy keys, Parker makes one
real membership payment, then refunds it in Zeffy. The factory never handles real keys.

## Backlog changes

| Old | New |
| --- | --- |
| M-3 Stripe products/prices | **M-3** Zeffy client, spec snapshot, fixtures, level-mapping table (launch-1) |
| M-4 Join & Stripe Checkout | **M-4** Join page with Zeffy form, thank-you polling page (launch-1) |
| M-5 Stripe webhook | **M-5** Zeffy webhook + nightly reconciliation + admin review list (launch-1) |
| M-6 Stripe Customer Portal | **M-6** Auto-renew status + "Manage payment" link to Zeffy (launch-1) |
| A-1 record check/cash | A-1 also writes the payment to Zeffy (launch-1) |
| — | **Z-1** event ↔ Zeffy campaign link (launch-1) · **Z-3** Buy tickets + prices (launch-1) · **Z-2** import campaigns as draft events (launch-2) · **Z-4** contact upsert (launch-1) · **Z-5** My tickets (launch-2) |

Dependencies: M-4, M-5 and A-1 need M-3. M-6 needs M-5. G-1 (ClubExpress import) needs M-5. Z-1, Z-2
and Z-3 need M-3 and C-1.
