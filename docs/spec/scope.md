# Contracted scope (from Exhibit A of the signed agreement)

Fixed fee, fixed scope. Build what is here. Anything else needs a human decision (it may be a paid
Change Order). Launch target: about 10–11 weeks from kickoff.

## Deliverables

| Area | Included |
| --- | --- |
| Design | Visual design with the Society's logo, colors and photos. Home page + four page templates: Directory, Band Spotlight, Promo Feature, Standard. Two revision rounds. Responsive. |
| Content Studio | Volunteer editing (Sanity) for pages, blog posts, events, venues, sponsors, directory entries, photos and site settings. Live preview, automatic drafts, shareable preview links. |
| Public pages | Home, About & Volunteer (sign-up form emails the coordinator), Membership Benefits & Join, Donate, Sponsors, Contact, privacy policy & terms (template text the client reviews). |
| Events calendar | Month and list views, weekly/monthly repeating events, venues, categories, member pricing, members-only events, add-to-calendar, subscribable calendar (ICS) feed. |
| Blog | Posts with categories, cover photos, scheduling, members-only option, "include in monthly digest" option. |
| Musician classifieds | Member submission form with photo, moderation queue (approve/reject + emails to poster), auto-expiry after 60 days with renewal reminder, "My listings" page. |
| Membership & dues | Up to 4 levels; Stripe checkout with optional yearly auto-renew; Stripe-hosted page to update card and download receipts; email-link or password sign-in; family memberships; manual recording of check/cash payments. |
| My Account | Status, renewal date, perks, profile and email preferences, the member's classifieds. |
| Members-only content | Any page, post, event or file can be limited to members or specific levels, stored so it is not publicly readable. |
| Admin screens | Member list (search, filter by status/level, CSV export, record payment). Classifieds moderation queue. Roles: Administrator, Membership Manager, Editor, Moderator. |
| Email | Automatic: welcome, receipts, renewal reminders 30 and 7 days before expiry, lapsed note 14 days after, listing approved/rejected/expiring. Member groups (active, expiring, lapsed, by level) sync to MailerLite. One newsletter template. Email authentication on the client's domain. |
| Donations | Zeffy donation form embedded on the Donate page. |
| Sponsors | Levels, featured-sponsor spotlight (home + Sponsors page), auto-hide after end date. |
| Data migration | One import of the ClubExpress member CSV keeping expiration dates; mailing list into MailerLite. |
| Training & handover | Two recorded training sessions (humans), written how-to guide, technical docs in the repo. |
| Launch & support | Launch on the client's domain, redirects from old URLs, 30 days of launch support. |

## Complimentary add-ons (agreed, not billed)

| Area | Included |
| --- | --- |
| Member gig submission | Band/Business/Sponsor members submit gigs from My Account; creates a draft event for an editor to approve. See `docs/decisions/0003-member-gig-submission.md`. Agreed 2026-11-26. |

## Delivery plan

Soft launch ("Launch 1") by 2026-12-11, then "Launch 2" — see `docs/decisions/0002-soft-launch-plan.md`.

## Assumptions

- Up to 15 pages set up with client-provided content; volunteers enter the rest.
- Browsers: current Chrome, Safari, Edge, Firefox; desktop and mobile.
- Reasonable efforts toward WCAG 2.1 AA.

## Not included (ask before doing any of this)

Online ticket sales, merchandise store, mobile app, public musician directory, paid classifieds or ads,
integrations with other systems (e.g. accounting), writing/editing content, photography, migrating old
newsletters beyond one archive page of PDFs, maintenance after launch support.

## Milestones

| Weeks | Phase | Milestone |
| --- | --- | --- |
| 1–2 | Discovery | Specs, levels and prices, content checklist |
| 2–3 | Design | **Design Approval** (human gate; triggers invoice 2) |
| 3–7 | Build | Working preview site |
| 7–8 | Classifieds, email, data | Member import rehearsal, test sign-ups |
| 9–10 | Training & review | Client sign-off |
| 10–11 | Launch | **Launch** (human gate; payments live) |
