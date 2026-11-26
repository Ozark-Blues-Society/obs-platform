# Design tokens

Backlog D-1. The tokens live in [`app/globals.css`](../../app/globals.css) as a Tailwind `@theme`,
so each one is both a utility class (`bg-canvas`, `text-muted`, `rounded-card`) and a CSS variable
(`var(--color-canvas)`). They come from the approved concept, [`prototype.html`](prototype.html).

**The colors and fonts are placeholders** until the Society's real logo and colors arrive
([board decisions](../spec/board-decisions.md), "Brand and content"). Token names say what a color
is for, not what it looks like, so the real brand goes in by changing values, not names. See
[Swapping in the real brand](#swapping-in-the-real-brand).

- Pages and components use tokens only: no hex values, `rgb()` or Tailwind palette classes such as
  `text-neutral-700` outside `app/globals.css`. Tailwind's default palette is switched off, and
  `lib/design/no-hard-coded-colors.test.ts` fails on hard-coded colors. A new color goes into
  `app/globals.css` and the tables below.
- Light theme only: no `dark:` variants. `color-scheme: light` keeps form controls and scrollbars
  light when a visitor's device is in dark mode.

## Colors

| Token           | Value     | Prototype                                                 | Use for                                                                              |
| --------------- | --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `primary-dark`  | `#0e1a2b` | `--night`                                                 | Header, footer, hero, toast; text on `accent`                                        |
| `primary`       | `#1d3557` | `--blue`                                                  | Page header band, dark buttons, date badges, selected pills                          |
| `primary-light` | `#2b4c7e` | `--blue2`                                                 | Links                                                                                |
| `primary-soft`  | `#e6ecf5` | `--blue-soft`                                             | Default tags, calendar chips                                                         |
| `accent`        | `#c9973f` | `--brass`                                                 | Main buttons, call-to-action band, selected borders; as text only on dark            |
| `accent-light`  | `#f0d49a` | `--brass-l`                                               | Accent text on `primary` and `primary-dark`                                          |
| `accent-soft`   | `#f6e6c3` | brass tag background                                      | "Members only", "Pending" and "Expiring soon" tags                                   |
| `accent-dark`   | `#7a5512` | brass tag text                                            | Accent text on light backgrounds: eyebrows, tags                                     |
| `success`       | `#2b7349` | `--green` (`#2f7d4f`), darkened to pass AA on its tag     | "Active", "Published", "Live"; approve                                               |
| `success-soft`  | `#dcefe3` | green tag background                                      | Success tags and messages                                                            |
| `danger`        | `#a8452f` | `--rust`                                                  | "Lapsed", reject, errors                                                             |
| `danger-soft`   | `#f4dcd5` | rust tag background                                       | "Lapsed" tags, error alerts                                                          |
| `canvas`        | `#f7f2e8` | `--cream`                                                 | Page background                                                                      |
| `surface`       | `#fffdf8` | `--paper`                                                 | Cards and panels                                                                     |
| `white`         | `#ffffff` | `#fff`                                                    | Form fields, filter pills; text on dark                                              |
| `ink`           | `#1c1a17` | `--ink`                                                   | Text                                                                                 |
| `muted`         | `#6b6458` | `--muted`                                                 | Secondary text                                                                       |
| `muted-soft`    | `#ece8df` | grey tag background                                       | Neutral tags                                                                         |
| `muted-on-dark` | `#cfd8e6` | hero and page header intro; nav and footer text are close | Secondary text on `primary` and `primary-dark`                                       |
| `line`          | `#e4dccb` | `--line`                                                  | Dividers and card borders, which are decorative                                      |
| `line-strong`   | `#8c8473` | new: replaces the form field border `#d7cfbd`             | Form field borders                                                                   |
| `focus`         | `#a97d2b` | new: the prototype has no focus style                     | Keyboard focus outline, set for every element in `app/globals.css`                   |

The prototype's semi-transparent colors are tokens with Tailwind's opacity modifier: modal
backdrop `bg-primary-dark/55`, nav link hover `bg-white/8`, "Next up" panel border
`border-accent-light/35`, members-only lock overlay `bg-canvas/97`.

## Contrast (WCAG 2.1 AA)

AA asks for 4.5:1 for text, and 3:1 for large text (24px, or 19px bold) and for what identifies a
control or its state, such as form field borders and focus outlines (WCAG 1.4.3 and 1.4.11). Every
text pair here is held to 4.5:1, headings included. `lib/design/tokens.test.ts` recomputes each
ratio from `app/globals.css`, and fails when one is under its minimum or differs from this table.
A pair the site uses belongs here.

| Text or element | Background     | Where                                                  | Ratio   | AA needs |
| --------------- | -------------- | ------------------------------------------------------ | ------- | -------- |
| `ink`           | `canvas`       | Body text                                              | 15.56:1 | 4.5:1    |
| `ink`           | `surface`      | Text on cards                                          | 17.08:1 | 4.5:1    |
| `ink`           | `white`        | Text in form fields and filter pills                   | 17.36:1 | 4.5:1    |
| `muted`         | `canvas`       | Secondary text                                         | 5.24:1  | 4.5:1    |
| `muted`         | `surface`      | Secondary text on cards                                | 5.76:1  | 4.5:1    |
| `muted`         | `white`        | Placeholder text in form fields, sponsor names         | 5.85:1  | 4.5:1    |
| `primary-light` | `canvas`       | Links                                                  | 7.72:1  | 4.5:1    |
| `primary-light` | `surface`      | Links on cards                                         | 8.47:1  | 4.5:1    |
| `accent-dark`   | `canvas`       | Eyebrows on light backgrounds                          | 6.00:1  | 4.5:1    |
| `accent-dark`   | `surface`      | Eyebrows on cards                                      | 6.59:1  | 4.5:1    |
| `danger`        | `canvas`       | Error messages                                         | 5.29:1  | 4.5:1    |
| `danger`        | `surface`      | Error messages on cards and forms                      | 5.81:1  | 4.5:1    |
| `success`       | `canvas`       | Success messages                                       | 5.15:1  | 4.5:1    |
| `primary`       | `primary-soft` | Default tags, calendar chips                           | 10.41:1 | 4.5:1    |
| `accent-dark`   | `accent-soft`  | "Members only", "Pending", "Expiring soon" tags        | 5.43:1  | 4.5:1    |
| `success`       | `success-soft` | "Active", "Published", "Live" tags                     | 4.79:1  | 4.5:1    |
| `danger`        | `danger-soft`  | "Lapsed" tags                                          | 4.51:1  | 4.5:1    |
| `ink`           | `success-soft` | Text in success messages                               | 14.47:1 | 4.5:1    |
| `ink`           | `danger-soft`  | Text in error alerts                                   | 13.27:1 | 4.5:1    |
| `ink`           | `accent-soft`  | Text in the preview banner                             | 14.08:1 | 4.5:1    |
| `muted`         | `muted-soft`   | Neutral tags ("Weekly", "Expired")                     | 4.79:1  | 4.5:1    |
| `white`         | `primary-dark` | Header, footer, hero and toast text                    | 17.48:1 | 4.5:1    |
| `muted-on-dark` | `primary-dark` | Hero intro, nav links, footer text                     | 12.17:1 | 4.5:1    |
| `accent-light`  | `primary-dark` | Logo tagline, the hero's "Next up" date                | 12.14:1 | 4.5:1    |
| `accent`        | `primary-dark` | Eyebrows on the hero                                   | 6.64:1  | 4.5:1    |
| `white`         | `primary`      | Page header, dark buttons, date badges, selected pills | 12.36:1 | 4.5:1    |
| `white`         | `primary-light` | Dark buttons on hover                                 | 8.61:1  | 4.5:1    |
| `muted-on-dark` | `primary`      | Page header intro                                      | 8.60:1  | 4.5:1    |
| `accent-light`  | `primary`      | Date badge month                                       | 8.59:1  | 4.5:1    |
| `primary-dark`  | `accent`       | Main buttons, call-to-action band; focus outline there | 6.64:1  | 4.5:1    |
| `white`         | `success`      | "Approve" button                                       | 5.75:1  | 4.5:1    |
| `line-strong`   | `white`        | Form field border                                      | 3.71:1  | 3:1      |
| `line-strong`   | `surface`      | Form field border on cards                             | 3.65:1  | 3:1      |
| `line-strong`   | `canvas`       | Form field border on the page                          | 3.32:1  | 3:1      |
| `focus`         | `canvas`       | Focus outline                                          | 3.33:1  | 3:1      |
| `focus`         | `surface`      | Focus outline on cards                                 | 3.65:1  | 3:1      |
| `focus`         | `white`        | Focus outline on white                                 | 3.71:1  | 3:1      |
| `focus`         | `primary-dark` | Focus outline on the header, footer and hero           | 4.71:1  | 3:1      |
| `focus`         | `primary`      | Focus outline on the page header                       | 3.33:1  | 3:1      |
| `primary-dark`  | `accent-soft`  | Focus outline on the preview banner                    | 14.17:1 | 3:1      |

Some of the prototype's pairs fail AA. Don't copy these:

- **Brass text on cream or paper** (the prototype's eyebrows, 2.36:1). Use `accent-dark` on light
  backgrounds. `accent` works as text only on `primary` and `primary-dark`.
- **The green tag** (`#2f7d4f` on `#dcefe3`, 4.20:1). `success` is darker than the prototype's
  green so that its tag passes.
- **Form field borders in `#d7cfbd` or `line`** (1.55:1 on white). Use `line-strong`.
- **Calendar days outside the month in `#bbb`** (1.79:1). Use `muted`.
- **The admin sidebar's section labels** (`#6d7380` on `#14181f`, 3.74:1). Pick a lighter label.
- **The focus outline on `accent`** (the call-to-action band): `focus` there is 1.41:1, so elements
  on an `accent` background add `focus-visible:outline-primary-dark`.

## Type

- **DM Serif Display** for headings (`font-serif`), **Inter** for everything else (`font-sans`, the
  default). `app/layout.tsx` loads both with `next/font/google`, which downloads the files at build
  time and serves them from this site, so visitors' browsers never contact Google.
- DM Serif Display has a single weight. Keep headings at the regular weight: `font-bold` makes the
  browser fake a bold.
- `h1`, `h2` and `h3` get the serif, the sizes below and a 1.15 line height without any classes.
  Body text is 15px with a 1.55 line height.

| Class          | Size                         | Prototype           | Use for                                                     |
| -------------- | ---------------------------- | ------------------- | ----------------------------------------------------------- |
| `text-h1`      | 32-54px, grows with the page | `h1`                | Page titles                                                 |
| `text-h2`      | 24-34px, grows with the page | `h2`                | Section headings                                            |
| `text-h3`      | 20px                         | `h3`                | Card titles                                                 |
| `text-lead`    | 18px                         | `.lead`             | Intro paragraphs                                            |
| `text-body`    | 15px                         | `body`              | Body text (the default)                                     |
| `text-sm`      | 14px                         | nav, footer, tables | Tailwind's default size                                     |
| `text-small`   | 13px                         | `.small`            | Meta lines, form labels, small buttons, pills               |
| `text-xs`      | 12px                         | captions            | Tailwind's default size                                     |
| `text-eyebrow` | 12px, bold, spaced           | `.eyebrow`          | The label above a section heading; add `uppercase`          |
| `text-tag`     | 11px, bold, spaced           | `.tag`              | Tags, calendar chips, table headings; add `uppercase`       |

Mind `text-small` (13px) versus Tailwind's `text-sm` (14px). The large serif figures (dates,
prices and totals at 26-44px) belong to their components (D-3).

## Spacing, radii and shadow

| Class           | Value                | Prototype                    |
| --------------- | -------------------- | ---------------------------- |
| `px-gutter`     | 20px                 | `.wrap` side padding         |
| `py-section`    | 56px                 | `.section` padding           |
| `max-w-site`    | 1160px               | `.wrap` width                |
| `rounded-card`  | 10px                 | `--r`: cards, toasts         |
| `rounded-panel` | 14px                 | the hero's "Next up" panel   |
| `shadow-card`   | two soft navy layers | `--shadow`                   |

Everything else uses Tailwind's own scales, which match the concept: spacing steps of 4px
(`gap-5` is 20px), `rounded-sm` (4px) for tags, `rounded-md` (6px) for nav links, `rounded-lg`
(8px) for form fields and date badges, and `rounded-full` for buttons and pills.

## Swapping in the real brand

1. Change the values in the `@theme` block of `app/globals.css`.
2. Run `pnpm test`. It names each value and ratio in this file that changed and each pair that no
   longer passes. Update the tables; for a failing pair, choose a darker or lighter value.
3. For new fonts, change the two `next/font/google` calls in `app/layout.tsx`, keeping their
   `variable` names (or update the `@theme inline` block in `app/globals.css`).
4. Update copies outside the web app, which can't read CSS variables: the Auth email templates in
   `supabase/templates/`, and the React Email templates' colors in `emails/_lib/theme.ts` (step 2's
   `pnpm test` names each of those that no longer matches).
