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
- Client components (`"use client"`) are only the ones with state or event handlers: `Modal`,
  `ToastProvider`/`useToast` and `PillFilters`. The rest render on the server too.

## The components

| Component | File | Use for |
| --- | --- | --- |
| `Button`, `ButtonLink` | `button.tsx` | Actions (`<button>`, `type="button"` by default) and links that look like buttons. Variants: `primary` (brass, the main call to action), `dark` (navy), `ghost` (outline in the surrounding text color, for light or dark backgrounds), `approve`, `reject`. Sizes `md` and `sm`. `buttonClasses()` for other elements. On a brass background use `dark`, and add `focus-visible:outline-primary-dark` (tokens.md). |
| `Card` | `card.tsx` | A paper panel with a border and soft shadow, no padding. `as="article"` for an item, `as="li"` in a list. |
| `Tag` | `tag.tsx` | Uppercase labels. Tones: `primary` (categories), `accent` ("Members only", "Pending", "Expiring soon"), `success` ("Active"), `danger` ("Lapsed"), `muted` ("Weekly"). |
| `PillFilters` | `pill-filters.tsx` | Picking one filter (an event or post category). A labelled group of toggle buttons; the selected one is `aria-pressed`. Controlled: `value` + `onChange`. |
| `Table` | `table.tsx` | Data tables. Typed columns (`cell`, `numeric`, `rowHeader`), a caption that names the table, and an empty message. Scrolls sideways in a focusable region on narrow screens. |
| `TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `Fieldset` | `form-fields.tsx` | Labelled controls with `hint` and `error`, wired to `aria-describedby` and `aria-invalid`. Mark optional fields in the label ("Photo (optional)"). Group checkboxes in a `Fieldset` with a `legend`. |
| `Modal` | `modal.tsx` | Dialogs, on `<dialog>`: the page behind is inert, Tab cycles inside, Escape and the × button call `onClose`, and focus returns to where it was. Focus starts on the first control or on `data-autofocus`. The parent owns `open`. |
| `ToastProvider`, `useToast` | `toast.tsx` | Short confirmations ("Saved"). One at a time, 5 seconds, in a polite live region that's always in the page. Wrap the part of the app that calls `useToast()` in a `ToastProvider`. |
| `LockOverlay` | `lock-overlay.tsx` | What a visitor sees instead of a members-only page or section: a lock box with Sign in and Join now over a blurred placeholder. Point `signInHref` back at the page (`/sign-in?next=…`). |
| `EventCard` | `event-card.tsx` | An event in a list: date badge, tags (Members only, category, Weekly/Monthly), title linked to the event, venue and time, price and members' price. Leave `venue` out where the viewer may not see it. |
| `PostCard` | `post-card.tsx` | A post in a list: cover (a `next/image` with `fill`, or a placeholder), tags, date, title and excerpt. `locked` shows the headline and a blurred stand-in sentence, and accepts no excerpt. |
| `SponsorLogo` | `sponsor-logo.tsx` | A sponsor's logo, or its name in a dashed box until the logo arrives. `placement` is the sponsor tier's logo placement (`large`, `logo`, `name`). |

## Tests

Interactive behavior has unit tests next to each component (`*.test.tsx`): the modal's focus trap,
Escape and focus return, the toast's live region and timing, and the pill filters' pressed state.
jsdom has no `showModal()`, so `modal.test.tsx` stands in for it (its `close()` fires the `close`
event later, as browsers do); `e2e/dev-components.spec.ts` checks the same behavior in a real
browser on the dev server (CI runs only its production 404 test).
