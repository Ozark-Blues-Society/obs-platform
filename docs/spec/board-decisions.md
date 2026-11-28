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
| Shared Society email | Not yet created. The current site shows a Gmail address (see "The current site" below). Whether that one can become the shared Society email: ask (**PENDING**). |
| Stripe, Zeffy, Supabase, Sanity, Netlify, MailerLite, Resend, password manager | Not started (agents use local/test-mode services meanwhile) |
| GitHub | Done: Ozark-Blues-Society organization, repo `obs-platform` |
| Domain | Registered at GoDaddy. Login: Parker to set up on a call. **No email is used on the domain.** |
| Current website | Hosted at GoDaddy under Diane's account. What must carry over: ask Diane (**PENDING**). What it shows today: see "The current site" below. |
| ClubExpress member export, contract terms, mailing list export | **PENDING** |
| Social media links | Not sent by the board. The current site links three pages (see "The current site" below). |
| Analytics | **PENDING** |

## The current site (decision 0014)

On 2026-11-27 Parker pulled these facts and files from the Society's current website into the factory
brand intake folder (`~/factory/brand-intake/`, outside the repo; read its `BRAND-NOTES.md` first).
They describe the old site and aren't answers from the board, so where they differ from §1–§9, those
sections win.

| Item | On the current site |
| --- | --- |
| Facebook | https://www.facebook.com/OzarkBluesNWA/ |
| Instagram | https://www.instagram.com/ozarkbluessocietynwa |
| YouTube | https://www.youtube.com/channel/UC_3xvyXGWdEAH6037bm-bnA (the old site's link, copied into `BRAND-NOTES.md`, leaves out `/channel/` and returns 404; checked 2026-11-28) |
| Membership | ClubExpress (`obsnwa.clubexpress.com`) |
| Donations | A PayPal donate button. The Society doesn't use Zeffy yet: Zeffy comes with the new site (decision 0007, corrected by 0014). |
| Public email | A Gmail address, in `BRAND-NOTES.md`. See "Shared Society email" above. |

- **Social links** are entered in the Content Studio under **Site settings** → **Social links**
  (`docs/volunteer-guide/site-settings.md`).
- **Mission:** "The Ozark Blues Society is dedicated to preserving and promoting the rich heritage of
  blues music. Through education and community outreach, we aim to inspire a new generation of blues
  artists and enthusiasts."
- **Perks and newsletter:** the old site promises a *weekly* newsletter, plus preferred seating and
  meet-and-greets "when available". §1 has a *monthly* newsletter and neither of the others, so the
  new site follows §1.
- **Recurring events** (calendar placeholders until real events arrive): the house band (Ozark Howlers)
  on the first Thursday, the Blues Jam on the second and fourth Thursdays, and an open jam at Morano's
  on the first Monday. The jams were at Music Depot until June 2026; from July the jams and house-band
  nights are at Pub on the Bricks. Also festival sets (Bikes Blues & BBQ, Eureka Springs Blues
  Festival), the Blues Challenge and the IBC fundraiser. The old schedule stops in August 2026; the
  intake's `text/events-text.txt` has all of it.
- **Sponsors:** logos for Arkansas Musicworks, M&D Furniture + Pinnacle Rug Cleaning (one combined
  logo), Thomas Family Agency, Music Moves and Pinnacle Rug Cleaning; photos, not logos, for Crisp
  Recording Studios and Allen's Food Market. The Sponsor Spotlight is Bob Arvin Realtor (no logo on the
  site). The sponsor tiers (§8) and the final list are still **PENDING**.

## Brand and content

The board hasn't sent its files yet. Under decision 0014, brand assets from the current site stand in:
the D-4 Design Approval package uses them now, and the board's files replace them if they arrive.
Commit only optimized copies of the files actually used, never the whole intake folder, and nothing
from its `people/` folder.

| Item | From the current site | Still needed from the board |
| --- | --- | --- |
| Logo | The original 1638×1638 JPG, plus transparent and all-white PNGs made from it | Whether a vector (SVG) exists. If not, the logo can be traced later. |
| Colors | Brand navy `#003060` and ink `#181818`, both taken from the logo. The old site's slate navy `#232c3b` and League Spartan headings are GoDaddy template defaults, not brand choices. The prototype's brass stays the accent unless the board objects. | — |
| Fonts | No brand fonts exist. Keep the prototype's DM Serif Display and Inter. | — |
| Photos | 20 event photos; `BRAND-NOTES.md` names the hero picks. `IMG_3362` to `IMG_3375` carry a photographer's watermark: show the credit "J.C. Prazak Photography" with them. The old site's share image is a Getty stock photo licensed only inside GoDaddy's builder, so it isn't in the intake and can't be reused. | Permission for the watermarked photos (contract Section 3.4 puts photo rights on the Society), and confirmation that the rest are the Society's own |
| Headshots | 8 unnamed photos. Never commit them; don't publish them until the board says who is who and agrees. | Names and consent |

Decision 0014 spells the credit "Pruszak", but the watermark reads "Prazak". Use "Prazak" until
Q-20261127-232339-17742 is answered.

Board list, volunteer roles, donation impact examples, venue directory data, real events, the rest of
the page text and blog posts: **all PENDING**. Agents build those with clearly marked placeholder
content and the approved design concept (`docs/design/`) until real content arrives.

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
