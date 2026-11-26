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
| 10% off paid Society events and other paid items | — | — | — | ✓ |
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
- **"Post gigs on the Event Calendar"** for Band/Business/Sponsor: members submit gigs through a form that creates a draft event for an editor to approve. Complimentary add-on — see `docs/decisions/0003-member-gig-submission.md` (Launch 2).

## 2. Family memberships

**None.** The board did not create a family level. Don't build household features unless this changes.

## 3. Renewal timing

Each member renews on their **join anniversary**.

## 4. Grace period

**None.** Access to members-only content ends at the expiration date. Renewal reminders still go out at 30 and 7 days before expiry, and the lapsed note at 14 days after.

## 5. Member discounts

- All members and sponsors: **15% off Society merchandise** (not bulk purchases). Fulfilled offline; show a perk code on My Account.
- Sponsors: **10% off paid Society events and other paid items** (from the Society). Fulfilled offline; show as a Sponsor benefit and a Sponsor perk code on My Account. No ticketing is built.

## 6. Members-only content

Driven by the benefits table above. In short: the event calendar's members-only events, the venue directory (contacts for Band and above only), member perks on My Account, and posting in the classifieds.

## 7. Classifieds

- **Viewing is public.** Posting requires an active membership (any level). **Every level can post in all five categories.**
- **Categories:** Musicians Wanted, Gear, Merch, Street Team, Member Connect.
- **Moderator:** Kelly.
- **Listing duration:** 60 days (contract default; the board didn't specify), with a renewal reminder 5 days before.

## 8. Sponsor levels

The $500/year Sponsor membership exists now. **The three sponsor tiers are TBD — the board will revisit.** Build sponsor tiers as data (name, price, benefits, logo placement) so tiers can be added in the Content Studio later without code changes. Until then, use one tier, "Sponsor".

## 9. Target launch

The board's target is **December 11, 2026 or earlier**. **Decided: a reduced soft launch ("Launch 1") by Dec 11, the rest ("Launch 2") after** — see `docs/decisions/0002-soft-launch-plan.md` for exactly what is in each and the critical-path dates.

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

## Resolved questions (Parker, 2026-11-26)

| Q | Answer |
| --- | --- |
| Q-A Members posting gigs | Member gig-submission form → draft event → editor approves. Complimentary add-on (decision 0003), Launch 2. |
| Q-B Launch date | Reduced soft launch by Dec 11; build continues around the clock (decision 0002). |
| Q-C Classifieds by level | All members can post in all five categories. |
| Q-D Sponsor discount | The Society gives sponsors 10% off paid events and other paid items. |
| Q-E Business + calendar | Everyone sees the calendar (it was an omission). |
