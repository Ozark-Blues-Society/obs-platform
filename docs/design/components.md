# Components

Backlog D-3. The shared components live in [`components/ui/`](../../components/ui/), one file each,
styled with the [design tokens](tokens.md) and modeled on the approved concept,
[`prototype.html`](prototype.html). The layout shell (header, footer, page header) is D-2's, in
`components/layout/`.

**See them all at [`/dev/components`](../../app/dev/components/page.tsx)** with `pnpm dev`, at phone
and desktop widths. The gallery exists in development only: a production build answers 404 there
(a unit test and `e2e/dev-components.spec.ts` check this).

## Rules

- **Props choose the look; `className` is for layout.** Two Tailwind classes that set the same
  property don't override each other in order (the stylesheet decides), so a component picks between
  them with a prop (`variant`, `tone`, `size`) and takes `className` only for margins, width or grid
  placement. `cx()` in `lib/cx.ts` joins class names.
- **Members-only content never goes into a component that blurs or hides it.** CSS blur and hidden
  elements still send the text to the browser. The server leaves the content out (decision 0001);
  `LockOverlay` and a `locked` `PostCard` take no content and draw a stand-in instead.
- **Dates show in the Society's time zone** (Central Time, `SOCIETY_TIME_ZONE`), whatever the
  server's or the visitor's: pass an ISO date-time and the card formats it with
  `lib/society-time.ts`.
- **Don't show a toast while a `Modal` is open.** The open dialog makes the rest of the page inert,
  the toast's live region included, so screen readers don't announce the message, and the dialog's
  backdrop covers the toast. Close the modal, then show the toast (in the same handler, as
  `ModalDemo` in `app/dev/components/demos.tsx` does), or confirm inside the dialog, for example
  with a `role="status"` line. The concept's event modal shows "Added to your calendar" and "Share
  link copied" toasts while it stays open: don't copy that part.
- **Each try gets a new message element.** While a form is sending (`pending`), hide its
  last error and its last confirmation. The next message is then a new element, which screen
  readers read out even when the text is the same; a message that stays on screen unchanged is read
  out by nobody. A check that fails in the browser, with no sending in between, gives its alert a
  `key` that changes with each try instead (`app/admin/files/upload-file-form.tsx` counts them).
- **Submit buttons stay enabled while their form sends.** Give `Button` the form's `pending`, not
  `disabled`: it's announced as unavailable (`aria-disabled`) and ignores presses, so the form isn't
  sent twice, but it keeps focus. Browsers take focus away from a disabled button, and screen reader
  users then lose their place. It still looks disabled, in forced-colors mode too, where browsers
  draw a disabled button in the system color GrayText but leave an `aria-disabled` one as it is:
  `Button` sets GrayText itself, and another pending button needs
  `forced-colors:aria-disabled:text-[GrayText]` (the roles screen's Remove buttons).
- Client components (`"use client"`) are only the ones with state or event handlers: `Modal`,
  `ToastProvider`/`useToast` and `PillFilters`. The rest render on the server too.

## The components

| Component | File | Use for |
| --- | --- | --- |
| `Button`, `ButtonLink` | `button.tsx` | Actions (`<button>`, `type="button"` by default) and links that look like buttons. Variants: `primary` (brass, the main call to action), `dark` (navy), `ghost` (outline in the surrounding text color, for light or dark backgrounds), `approve`, `reject`. Sizes `md` and `sm`. `pending` while its form is sending (see the rules). `buttonClasses()` for other elements. On a brass background use `dark`, and add `focus-visible:outline-primary-dark` (tokens.md). |
| `Card` | `card.tsx` | A paper panel with a border and soft shadow, no padding. `as="article"` for an item, `as="li"` in a list. |
| `Tag` | `tag.tsx` | Uppercase labels. Tones: `primary` (categories), `accent` ("Members only", "Pending", "Expiring soon"), `success` ("Active"), `danger` ("Lapsed"), `muted` ("Weekly"). |
| `PillFilters` | `pill-filters.tsx` | Picking one filter (an event or post category). A labelled group of toggle buttons; the selected one is `aria-pressed`. Controlled: `value` + `onChange`. |
| `PillLinks` | `pill-links.tsx` | The same pills as links, where each filter has its own web address (the blog's categories, `?category=`): a labelled `<nav>` list, the shown one `aria-current="page"`, and the page keeps its scroll position. Both take their classes from `pillClasses()` (`pill-classes.ts`). |
| `Table` | `table.tsx` | Data tables. Typed columns (`cell`, `numeric`, `rowHeader`), a caption that names the table, and an empty message. Scrolls sideways in a focusable region on narrow screens. |
| `TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `Fieldset` | `form-fields.tsx` | Labelled controls with `hint` and `error`, wired to `aria-describedby` and `aria-invalid`. Mark optional fields in the label ("Photo (optional)"). Group checkboxes in a `Fieldset` with a `legend`. An `error` isn't read out when it appears: pass it as `<span role="alert">` (the sign-in forms), or move focus to the field once it shows (`app/admin/files/upload-file-form.tsx`). |
| `FormError`, `SuccessBox` | `form-fields.tsx` | A form's own messages. `FormError`: a problem with the whole form, not one field (an alert). `SuccessBox`: what the form did ("Check your email."), inside a `role="status"` element that's always in the page. |
| `Modal` | `modal.tsx` | Dialogs, on `<dialog>`: the page behind is inert, Tab cycles inside, Escape and the × button call `onClose`, and focus returns to where it was. Focus starts on the first control or on `data-autofocus`. The parent owns `open`. No toasts while it's open (see the rules). |
| `ToastProvider`, `useToast` | `toast.tsx` | Short confirmations ("Saved"). One at a time, 5 seconds, in a polite live region that's always in the page. Wrap the part of the app that calls `useToast()` in a `ToastProvider`. Not while a `Modal` is open (see the rules). |
| `LockOverlay` | `lock-overlay.tsx` | What a visitor sees instead of a members-only page or section: a lock box with Sign in and Join now over a blurred placeholder. Point `signInHref` back at the page (`/sign-in?next=…`). |
| `EventCard` | `event-card.tsx` | An event in a list: date badge, tags (Members only, category, Weekly/Monthly), title linked to the event, venue and time, price and members' price. Leave `venue` out where the viewer may not see it. |
| `PostCard` | `post-card.tsx` | A post in a list: cover (a `next/image` with `fill`, or a placeholder), tags, date, title and excerpt. `locked` shows the headline and a blurred stand-in sentence, and accepts no excerpt. |
| `SponsorLogo` | `sponsor-logo.tsx` | A sponsor's logo, or its name in a dashed box until the logo arrives. `placement` is the sponsor tier's logo placement (`large`, `logo`, `name`). |
| `SponsorSpotlight` | `sponsor-spotlight.tsx` | The featured sponsor (one at a time): a logo panel, the blurb and a Visit button. On the home page and the Sponsors page. |
| `SectionHeading` | `section-heading.tsx` | A section's heading with an eyebrow above it and an optional "see everything" link at the right ("Full calendar"). |
| `CardGrid` | `card-grid.tsx` | A list of cards in as many 260px columns as fit (one on a phone). Put each card in an `<li>`. |
| `PlaceholderPhoto` | `placeholder-photo.tsx` | The concept's drawn stage scene where a photo goes, until the Society's photos arrive. Four tones; give it a `label` where it stands in for a meaningful photo, none where it's decoration. |

## Home page sections, page blocks and templates

D-4 (the Design Approval package) added the home page's sections (`components/home/`), a
component for each page block (`components/blocks/`) and `PageTemplate`
(`components/templates/`), which the sample pages at `/design-preview` use.
[`approval-package.md`](approval-package.md) maps each Sanity block type to its component and
says how the four templates differ.

## Tests

Interactive behavior has unit tests next to each component (`*.test.tsx`): the modal's focus trap,
Escape and focus return, the toast's live region and timing, and the pill filters' pressed state.
jsdom has no `showModal()`, so `modal.test.tsx` stands in for it (its `close()` fires the `close`
event later, as browsers do); `e2e/dev-components.spec.ts` checks the same behavior in a real
browser on the dev server (CI runs only its production 404 test).
