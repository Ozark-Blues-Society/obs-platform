# Board decisions

Source: the board's answers in "Getting Started — InfoFromBoard" (received 2026-11-25), plus Parker's
clarifications. Agents treat this file as the source of truth. Anything marked **PENDING** or **OPEN**
must be asked through `tools/ask-human.sh` before building the part that depends on it.

## 1. Membership levels (yearly, renew on each member's join anniversary)

| Level | Price | Who it's for |
| --- | --- | --- |
| Individual | $30 / year | Fans and individual musicians |
| Band | $50 / year | Bands and working groups |
| Business | $100 / year | Venues and local businesses |
| Sponsor | $500 / year | Sponsors. Gets everything Business gets, plus a Spotlight highlight. Three sponsor tiers are planned but **TBD** (see §8). |

### Benefits by level

| Benefit | Individual | Band | Business | Sponsor |
| --- | :-: | :-: | :-: | :-: |
| Post in the classifieds | ✓ | ✓ | ✓ | ✓ |
| Event calendar (view, members-only events) | ✓ | ✓ | ✓ | ✓ |
| Monthly newsletter | ✓ | ✓ | ✓ | ✓ |
| Eligible for VIP drawings, All Access passes and giveaways | ✓ | ✓ | ✓ | ✓ |
| 15% off Society merchandise (not bulk) | ✓ | ✓ | ✓ | ✓ |
| Venue directory: venue names and details | ✓ | ✓ | ✓ | ✓ |
| Venue directory: booking contacts | — | ✓ | ✓ | ✓ |
| Post gigs on the Event Calendar | — | ✓ | ✓ | ✓ |
| Ticket pre-sales and early entry (General Admission) | — | — | ✓ | ✓ |
| Sponsor Spotlight highlight | — | — | — | ✓ |

**How agents build these:**
- Benefits are shown as text on the Membership Benefits & Join page, driven by this table (keep it data, not hard-coded copy).
- **Venue directory** is level-gated at the field level: every member sees venue names and details; booking contacts are visible only to Band, Business and Sponsor. Contacts must not be readable by Individual members or the public through any API (see `docs/decisions/0001-members-only-storage.md`).
- **Drawings, passes, giveaways, merch discount, pre-sales and early entry** are benefits the Society fulfills offline. The site only lists them and shows a member perk code on My Account. No merch store, raffle system or ticketing is built (out of scope).
- **"Post gigs on the Event Calendar"** for Band/Business/Sponsor is **OPEN** — not in the signed scope. See Open questions, Q-A.

## 2. Family memberships

**None.** The board did not create a family level. Don't build household features unless this changes.

## 3. Renewal timing

Each member renews on their **join anniversary**.

## 4. Grace period

**None.** Access to members-only content ends at the expiration date. Renewal reminders still go out at 30 and 7 days before expiry, and the lapsed note at 14 days after.

## 5. Member discounts

- All members and sponsors: **15% off Society merchandise** (not bulk purchases). Fulfilled offline; show a perk code on My Account.
- **Tentative:** 10% sponsor discounts on select items. **OPEN** — see Q-D.

## 6. Members-only content

Driven by the benefits table above. In short: the event calendar's members-only events, the venue directory (contacts for Band and above only), member perks on My Account, and posting in the classifieds.

## 7. Classifieds

- **Viewing is public.** Posting requires an active membership (any level).
- **Categories:** Musicians Wanted, Gear, Merch, Street Team, Member Connect.
- **Moderator:** Kelly.
- **Listing duration:** 60 days (contract default; the board didn't specify), with a renewal reminder 5 days before.

## 8. Sponsor levels

The $500/year Sponsor membership exists now. **The three sponsor tiers are TBD — the board will revisit.** Build sponsor tiers as data (name, price, benefits, logo placement) so tiers can be added in the Content Studio later without code changes. Until then, use one tier, "Sponsor".

## 9. Target launch

The board's target is **December 11, 2026 or earlier** (before Christmas, mid-month). **OPEN** — this conflicts with the contract timeline (about 10–11 weeks from the Nov 10 kickoff, i.e. late January). See Q-B. Do not compress quality gates to chase this date without Parker's decision.

## Accounts and access (status from the board, 2026-11-25)

| Item | Status |
| --- | --- |
| Shared Society email | Not yet created |
| Stripe, Zeffy, Supabase, Sanity, Netlify, MailerLite, Resend, password manager | Not started (agents use local/test-mode services meanwhile) |
| GitHub | Done: Ozark-Blues-Society organization, repo `obs-platform` |
| Domain | Registered at GoDaddy. Login: Parker to set up on a call. **No email is used on the domain.** |
| Current website | Hosted at GoDaddy under Diane's account. What must carry over: ask Diane (**PENDING**). |
| ClubExpress member export, contract terms, mailing list export | **PENDING** |
| Social media links, analytics | **PENDING** |

## Brand and content

Logo, colors, photos, page text, board list, volunteer roles, donation impact examples, sponsors,
events, venue directory data and blog posts: **all PENDING**. Agents build with clearly marked placeholder
content and the approved design concept (`docs/design/`) until real content arrives on the file portal.

## People and roles

| Role | Name |
| --- | --- |
| Classifieds Moderator | Kelly |
| Old website account holder | Diane |
| Project Contact, Content coordinator, Administrators, Membership Manager, Editors, Treasurer, Newsletter writer | **PENDING** |

## Open questions (for Parker)

- **Q-A — Members posting gigs.** Band/Business/Sponsor members "post gigs on the Event Calendar." The contract has editors add events in the Content Studio, not members. Options: (1) members email gigs to an editor, no new feature; (2) a simple member gig-submission form that creates a draft event an editor approves (Change Order); (3) give trusted members editor access. *Recommendation: (1) for launch, (2) as a Change Order if the board wants it.*
- **Q-B — Launch date.** Board wants ≤ Dec 11; contract plans late January; Stripe and other accounts aren't created yet and no content has arrived. Options: (1) keep the contract timeline; (2) a reduced "soft launch" by Dec 11 (e.g. public pages + join/renew) with the rest following; (3) attempt full scope by Dec 11. *Needs Parker.*
- **Q-C — Classifieds by level.** Each level lists "Gear classifieds." Can every member post in all five categories, or are some categories limited by level?
- **Q-D — Sponsor discounts.** What is the "tentative 10% sponsor discounts on select items" — sponsors' businesses offering members 10% off, or the Society giving sponsors 10%? Does the site need to show it?
- **Q-E — Business level and the calendar.** The Business list omits "Calendar" while Individual and Band include it. Assumed an omission (everyone sees the calendar) — confirm.
