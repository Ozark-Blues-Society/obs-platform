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

**Sample content, the Society's brand.** Every event, post, person and venue is made up
(`sample-content.ts`; phone numbers in the 555-01xx range, addresses at example.com). The logo, the
colors, the photos and the sponsors are the Society's own, from its current website ([decision
0014](../decisions/0014-brand-assets-from-current-site.md); see [The brand](#the-brand)).

## The brand

Parker pulled the brand from the Society's current website into the factory's brand intake folder
(decision 0014). The repository holds only optimized copies of the files used, and nothing from the
folder's headshots, which nobody has confirmed. Files from the board, if they arrive, replace them
([Changing the brand](tokens.md#changing-the-brand)).

- **Logo:** the white version, trimmed and 192px high (`components/layout/obs-logo-white.png`), in
  the site header on every page, 56px high on phones and 64px on larger screens: its lettering is
  too fine for less. The website has no vector version; an SVG from the board, or a tracing, would
  be sharper.
- **Colors:** the blues are the logo's navy, `#003060`, and shades of it, and the text is the logo's
  near-black ([tokens](tokens.md)). The brass, the cream and the fonts stay the concept's.
- **Photos** (`images/`), resized and with their metadata (camera, place, time) removed:

  | File                        | From the intake folder    | Where                                          |
  | --------------------------- | ------------------------- | ---------------------------------------------- |
  | `trio-on-stage.jpg`         | `Trio_M1007640.11.jpeg`   | Home hero                                      |
  | `obs-stage.jpg`             | `IMG_5178.jpeg`           | Band Spotlight hero, the spotlight post's card |
  | `band-in-blue-light.jpg`    | `IMG_3273.jpeg`           | Promo Feature hero                             |
  | `festival-stage.jpg`        | `IMG_3368.jpeg`           | Standard page's photo, with the credit         |
  | `society-on-stage.jpg`      | `IMG_0755.jpeg`, cropped  | The members-only post's card                   |
  | `crowd.jpg`                 | `IMG_2633.jpeg`           | The recap post's card                          |

  `IMG_3362` to `IMG_3375` carry a photographer's watermark, and decision 0014 asks for his credit
  wherever they show: `PHOTO_CREDIT` in `sample-content.ts`, under the Standard page's photo. The
  credit is spelled as on the watermark, "Prazak" (decision 0014, Q-20261127-232339-17742). The
  intake notes ask the board to confirm the Society may use the photos.
- **Sponsors** (`images/sponsors/`): the website's sponsors, with their logos trimmed and 120px
  high, and its Sponsor Spotlight, Bob Arvin Realtor, for which it shows no logo or website. The
  website shows M&D Furniture's and Pinnacle Rug Cleaning's logos in one picture, one above the
  other, unreadable at the 40px a logo gets, so each has its own here. Crisp Recording Studios and
  Allen's Food Market have photos there rather than logos, so their names show in their place, as
  the design does until a logo arrives. The tiers and the final list are still to come from the
  board.
- **The Band Spotlight's band is made up**, so its hero is a stage before a show rather than
  players someone could take for that band.

## Open questions and the approval

- **Brand:** decided (decision 0014): the Society's current website's logo, colors, photos and
  sponsors, until the board sends its own files.
- **Preview link:** decided ([decision 0010](../decisions/0010-netlify-site.md)): the package is at
  `/design-preview` on the `develop` branch deploy of the Netlify site, and nobody shares the link
  with anyone other than Parker.
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
- **Hero blocks darken the photo under their text**, so any photo keeps the text readable: even
  over a white photo, every text keeps WCAG AA contrast at every screen width (measured from
  screenshots). The home hero darkens the text side of its photo and its Next up panel the same way.
- **"Upcoming shows" on a Band Spotlight lists the next events on the calendar**, not only that
  band's: the upcoming events block has no band filter (C-1).

## Removing it

Delete `app/(site)/design-preview/` and its entry in `RESERVED_PAGE_SLUGS`
(`sanity/schemas/options.ts`) once P-1 and C-2 show the approved design with the Studio's content,
and before launch.
