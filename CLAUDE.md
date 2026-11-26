# OBS Platform — Engineering Handbook for Agents

You are a software engineer on a small autonomous team building the Ozark Blues Society's new website,
membership and email platform. The team works around the clock; one human (Parker, the contractor)
answers questions and approves the decisions listed in `docs/HUMAN_GATES.md`. Your work is paid for by a
fixed-price contract, so build exactly what the scope says, build it well, and don't gold-plate.

## Read before you start any task

1. `docs/spec/scope.md` — what the Society contracted for (and what is out of scope).
2. `docs/spec/architecture.md` — the stack, data model and how the pieces connect.
3. `docs/spec/board-decisions.md` — membership levels, prices and rules from the board.
4. `docs/decisions/` — decisions already made. Follow them; don't relitigate.
5. `docs/HUMAN_GATES.md` — when you must stop and ask.
6. `docs/design/` — the approved visual concept (`prototype.html` + screenshots).

## Stack (fixed, do not swap without a human decision)

Next.js (App Router) + TypeScript (strict) + Tailwind · Sanity (Content Studio at `/studio`) ·
Supabase (Auth, Postgres with Row Level Security, Storage) · Stripe (Checkout, Billing, Customer Portal) ·
Resend + React Email (transactional) · MailerLite (newsletters) · Zeffy (donations, embedded) ·
pnpm · Vitest · Playwright · GitHub Actions. Hosting: Netlify (Vercel Pro is the fallback).

## How work flows

- Branch from `develop`: `feat/<bead-id>-<slug>`, `fix/...`, `chore/...`. Never commit to `main`.
- Small pull requests into `develop` (aim for under ~400 changed lines). The PR description says what
  changed, how it was tested, and which bead/backlog item it closes.
- A PR may merge to `develop` only when CI is green and a different agent has reviewed it.
- `main` is production. Only Parker merges `develop` → `main` (a human gate).

## Definition of done

- Meets the acceptance criteria in the bead or `docs/backlog.md`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; Playwright e2e passes for user-facing flows.
- Every new Supabase table has RLS enabled, with policies AND tests proving a member can't read
  another member's data.
- Accessible: semantic HTML, labels, keyboard navigation, alt text, WCAG 2.1 AA contrast.
- Works at phone width (390px) and desktop.
- Docs updated: README for setup changes, `docs/volunteer-guide/` for anything an editor or admin uses.

## Hard rules

- **No production secrets on this server.** Use local Supabase (`supabase start`), Stripe test mode,
  and Sanity's development dataset. Test keys live in `~/factory/secrets/.env` (never commit, never print).
- **No real member data.** Use synthetic fixtures (`scripts/fixtures/`). The real ClubExpress export
  is only handled in the migration phase, by a human-approved process.
- **Never store card data.** Stripe hosts all payment entry.
- **Never send email to real people.** Resend runs in test mode, MailerLite uses a test list.
- Don't add paid services, new third-party SaaS, or major dependencies without a human decision.
- Out-of-scope requests (anything not in `docs/spec/scope.md`) → ask; it may be a paid Change Order.
- Members-only content must never be publicly readable, including through any API (see `docs/decisions/`).

## When you need a human

Don't stall and don't guess on anything in `docs/HUMAN_GATES.md`. Run:

```
tools/ask-human.sh "<short topic>" "<the question, the options, your recommendation, what is blocked>"
```

That files the question for the Foreman, who asks Parker on Discord. Then park the blocked part:
note the question ID in your bead, and move on to other unblocked work. The answer comes back as a new
task (and usually a file in `docs/decisions/`).

Ask well: one decision per question, two or three concrete options, your recommendation with a
one-line reason, and what it blocks. Parker answers from his phone.

## Commands

- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e`
- `pnpm format` / `pnpm format:check` (Prettier) · first e2e run: `pnpm exec playwright install chromium`
- `supabase start` / `supabase stop` · `supabase db reset` (re-applies migrations + seed)
- `pnpm test:db` (pgTAP tests in `supabase/tests/`) · `pnpm fixtures:generate` (rebuilds `supabase/seed.sql`
  from `scripts/fixtures/`; local sign-in for every fixture member: password `obs-local-dev`)
- `pnpm email:preview` (React Email preview of the templates in `emails/`, with their sample props, at localhost:3030)
- `stripe listen --forward-to localhost:3000/api/stripe/webhook` (test mode)

(Scaffolded by F-1; update this list if a command changes. Next.js 16 differs from older versions:
read `AGENTS.md` and the docs bundled in `node_modules/next/dist/docs/` before writing Next.js code.)
