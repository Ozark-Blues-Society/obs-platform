# Design Approval package

Backlog D-4, the contract's **Design Approval** milestone ([scope](../spec/scope.md), Milestones):
the home page and the four page templates (Standard, Directory, Band Spotlight, Promo Feature),
deployed where the Society can open them, for Parker and the board to approve. Approval is a human
gate ([HUMAN_GATES](../HUMAN_GATES.md)) and triggers invoice 2. Two revision rounds are included.

## The pages

Every page is under [`app/(site)/design-preview/`](<../../app/(site)/design-preview/>), in the
site's own layout, with sample content. A strip at the top of each says it's a preview and links
to the others. Search engines are asked to skip them (`noindex`).

| Path                                   | What it shows                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `/design-preview`                      | The overview: how to review, and links to every page                             |
| `/design-preview/home`                 | Home: hero with Next up, upcoming events, latest posts, sponsors, join band      |
| `/design-preview/standard`             | Standard template: About the Society (text, a photo, a button)                   |
| `/design-preview/directory`            | Directory template, members-only, as a Band, Business or Sponsor member sees it  |
| `/design-preview/directory/individual` | The same page as an Individual member sees it: no booking contacts               |
| `/design-preview/directory/visitor`    | The same page as a visitor sees it: the title and a lock, none of the content    |
| `/design-preview/band-spotlight`       | Band Spotlight template: The Muddy Ridge Trio (hero, story, quote, video, shows) |
| `/design-preview/promo-feature`        | Promo Feature template: Blues Challenge 2027 (banner, details, button, sponsors) |

**Sample and placeholder.** Every event, post, person, venue and sponsor is made up
(`sample-content.ts`; phone numbers in the 555-01xx range, addresses at example.com). The logo,
colors and fonts are the concept's placeholders ([tokens](tokens.md)), and the photos are drawn
stage scenes (`PlaceholderPhoto`). The real brand goes in by changing token values ([Swapping in
the real brand](tokens.md#swapping-in-the-real-brand)) and the logo in
`components/layout/site-header.tsx`.

## Open questions and the approval

- **Brand:** Q-20261126-084157-6494 (filed 2026-11-26) asks whether the board sends the logo,
  colors and photos before the Dec 2 approval date or the approval goes ahead on the placeholders.
- **Preview link:** Q-20261126-084158-1521 asks Parker to create the Society's Netlify account
  (production branch `main`, branch deploys for `develop`). Nothing is deployed until then.
- **Approval:** once the link works, file the approval question with `tools/ask-human.sh`,
  linking to `/design-preview` on the preview, and note its ID on bead op-i9b. Agents never approve
  the design themselves. Record the answer in `docs/decisions/`, with the commit that was approved.
- **Revision rounds:** make the changes in the components (below), not in the sample pages, so the
  real home page and pages get them too. Note each round's requests on op-i9b.

## How it's built

The sample pages only pass sample content to shared components, which P-1 (home) and C-2 (pages)
then fill from the Studio instead.

- **Home** (`components/home/`): `HomeHero` (headline, two buttons and the Next up panel),
  `CardSection` (upcoming events, latest posts), `SponsorBand` (the featured sponsor's spotlight
  and every sponsor's logo) and `MembershipCta` (the brass band).
- **Blocks** (`components/blocks/`): one component per page block, taking plain values:

  | Block (`_type`)       | Component                                        | Notes                                                   |
  | --------------------- | ------------------------------------------------ | ------------------------------------------------------- |
  | `heroBlock`           | `HeroBlock`                                      | `headingLevel={1}` when it's the page's first block     |
  | `textBlock`           | `Prose`                                          | Wraps the rendered rich text                            |
  | `imageBlock`          | `ImageBlock`                                     | `image`: `next/image` with `fill`                       |
  | `videoBlock`          | `VideoBlock`                                     | `player`: the YouTube, Vimeo or Bandcamp `<iframe>`     |
  | `upcomingEventsBlock` | `UpcomingEventsBlock`                            | `EventCard` props per event                             |
  | `sponsorStripBlock`   | `SponsorStripBlock`                              | Draws nothing when no sponsor is current                |
  | `tableBlock`          | `TableBlock`                                     | `searchLabel` adds the search box (Directory pages)     |
  | `buttonBlock`         | `ButtonLink` ([components](components.md))       |                                                         |
  | `quoteBlock`          | `QuoteBlock`                                     |                                                         |
  | `formBlock`           | (P-5's volunteer form)                           |                                                         |

- **Templates** (`components/templates/page-template.tsx`): `PageTemplate` opens a page with the
  blue page header (title, intro, and a Members only tag) or, when the page starts with a hero,
  with the hero. Blocks follow at the full width, and each sets its own measure: text and quotes
  stay readable, photos and videos up to 768px, tables, events and sponsors full width. The four
  templates differ in the blocks they start with (the concept's), which C-2 can set as initial
  values:

  | Template       | Starting blocks                                   | Opens with  |
  | -------------- | ------------------------------------------------- | ----------- |
  | Standard       | Text, photo, button                               | Page header |
  | Directory      | Text, table (searchable)                          | Page header |
  | Band Spotlight | Hero, text, pull quote, video, upcoming events    | Hero        |
  | Promo Feature  | Hero, text, button, sponsor logos                 | Hero        |

### Choices the specs didn't make

These are in the package for the Society to approve or change.

- **The Directory has no "Suggest an addition" form**, though the concept's template listed one:
  the content model's only form is the volunteer sign-up, and the scope names no such form. A line
  of text links to Contact instead. A form would be new scope.
- **Who sees what in the Directory** follows the board's benefits table: Individual members see
  the venues without the booking contact column, with a note saying who sees contacts, and
  visitors see the page header and a lock. The sample pages leave out what each viewer can't see,
  as the real directory must (decision 0001, M-9).
- **The featured sponsor's spotlight is on the home page** (the scope puts it on home and the
  Sponsors page; the concept's home page showed only the logos).
- **Membership starts at $30 a year** (the board's Individual price; the concept said $25).
- **Pages have an intro sentence** under the title, as the concept's do: the page's Intro field
  (C-2). Like the title, it's public, so a visitor sees it above the lock on a members-only page,
  as in the concept's Directory page.
- **Hero blocks darken the photo under their text**, so any photo keeps the text readable.
- **"Upcoming shows" on a Band Spotlight lists the next events on the calendar**, not only that
  band's: the upcoming events block has no band filter (C-1).

## Removing it

Delete `app/(site)/design-preview/` and its entry in `RESERVED_PAGE_SLUGS`
(`sanity/schemas/options.ts`) once P-1 and C-2 show the approved design with the Studio's content,
and before launch.
