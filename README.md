# Ozark Blues Society platform

The Ozark Blues Society's new website, membership and email platform: Next.js (App Router) with
TypeScript and Tailwind, plus Sanity, Supabase, Stripe, Resend and MailerLite as the backlog adds
them.

- What we're building: [`docs/spec/scope.md`](docs/spec/scope.md),
  [`docs/spec/architecture.md`](docs/spec/architecture.md), [`docs/backlog.md`](docs/backlog.md)
- How we work (branches, pull requests, definition of done): [`CLAUDE.md`](CLAUDE.md)

## Prerequisites

- **Node.js 24** (see `.nvmrc`; `nvm use` picks it up).
- **pnpm 12**, the version pinned in `package.json` (`packageManager`). Run `corepack enable` once,
  or install pnpm yourself.
- For the local database, **Docker** and the **Supabase CLI 3.x** (`supabase --version`; this repo
  was set up with 3.4). See [Local Supabase](#local-supabase).
- For end-to-end tests, a Playwright browser. Install it once with
  `pnpm exec playwright install --with-deps chromium` (drop `--with-deps` if your system libraries
  are already in place).

## Setup

```bash
git clone https://github.com/Ozark-Blues-Society/obs-platform.git
cd obs-platform
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

No environment variables are needed yet. Typed environment config and `.env.example` arrive with
backlog item F-4. Never commit secrets.

## Scripts

| Command                  | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `pnpm dev`               | Start the development server on port 3000                          |
| `pnpm build`             | Production build                                                   |
| `pnpm start`             | Serve the production build                                         |
| `pnpm lint`              | ESLint (Next.js core-web-vitals and TypeScript rules)              |
| `pnpm typecheck`         | Generate Next.js route types, then `tsc --noEmit` (strict mode)    |
| `pnpm test`              | Unit tests with Vitest, once                                       |
| `pnpm test:watch`        | Unit tests in watch mode                                           |
| `pnpm test:e2e`          | Playwright end-to-end tests (desktop and 390px phone, in Chromium) |
| `pnpm test:db`           | Database tests (pgTAP) against the local Supabase stack            |
| `pnpm fixtures:generate` | Regenerate `supabase/seed.sql` from `scripts/fixtures/`            |
| `pnpm format`            | Format the code with Prettier                                      |
| `pnpm format:check`      | Check formatting without writing changes                           |

## Tests

- **Unit tests** (Vitest + Testing Library, jsdom) live next to the code as `*.test.ts` or
  `*.test.tsx`. Vitest can't render `async` Server Components; cover those with end-to-end tests.
- **End-to-end tests** (Playwright) live in `e2e/`. Every test runs at desktop size and at phone
  width (390px). Locally, Playwright starts `pnpm dev`, or reuses a dev server already running on
  port 3000. With `CI=1` it serves the production build instead, so run `pnpm build` first. Set
  `E2E_PORT` to use another port.

## Local Supabase

Auth, Postgres and file storage run locally in Docker through the Supabase CLI. Development only
uses this local stack: creating hosted Supabase projects is a human gate
([`docs/HUMAN_GATES.md`](docs/HUMAN_GATES.md)).

```bash
supabase start      # start the stack; a fresh one also applies the migrations and seed
supabase db reset   # rebuild the database: supabase/migrations/, then supabase/seed.sql
pnpm test:db        # pgTAP tests in supabase/tests/ (runs `supabase test db`)
supabase stop       # stop the stack; the data is kept until the next reset
```

`supabase start` and `supabase status` print the local URLs and API keys. The keys are the same
well-known demo keys on every machine and only work against the local stack. F-4 adds them to
`.env.example`.

| Service                                             | Local address                                             |
| --------------------------------------------------- | --------------------------------------------------------- |
| API (REST, Auth, Storage)                           | <http://127.0.0.1:54321>                                  |
| Postgres                                            | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (database admin)                             | <http://127.0.0.1:54323>                                  |
| Mailpit (catches Auth emails such as sign-in links) | <http://127.0.0.1:54324>                                  |

The ports are fixed, so a machine runs one stack (project id `obs-platform`), and
`supabase db reset` resets it for everyone using it.

### Migrations and database tests

- `supabase migration new <name>` creates a migration in `supabase/migrations/`.
- Every new table needs row level security, policies and pgTAP tests (see `CLAUDE.md`). Tests go in
  `supabase/tests/` as `<name>_test.sql`; `supabase test new <name>` writes a template.
- `supabase/tests/rls_baseline_test.sql` fails if any table in `public` has row level security
  off, or any view there bypasses it (no `security_invoker`).

### Fixtures and seed data

Synthetic data lives in `scripts/fixtures/`. Real member data never goes in the repo.

- `members.mts`: 40 members across the four levels and three statuses (active, expiring,
  lapsed), including the staff roles below.
- `listings.mts`: classifieds in every category and status.
- `events.mts`: events and venues. Events live in Sanity, so these go to Sanity's development
  dataset once the schemas exist (C-1).

`supabase/seed.sql` is generated from the fixtures by `pnpm fixtures:generate`, and `pnpm test`
fails if it's out of date. The seed loads only tables that exist. Today that's the members'
sign-ins; profiles, roles (M-2) and listings (K-1) join it with their migrations.

Every fixture member can sign in locally with their address (for example
`avery.collins@example.com`) and the password `obs-local-dev`. Staff roles take effect once M-2
adds them:

| Role               | Fixture member              |
| ------------------ | --------------------------- |
| Administrator      | `avery.collins@example.com` |
| Membership Manager | `jordan.ellis@example.com`  |
| Editor             | `morgan.hale@example.com`   |
| Moderator          | `dale.ramsey@example.com`   |

## Project layout

```
app/                Next.js App Router: pages, layouts, route handlers
e2e/                Playwright end-to-end tests
scripts/fixtures/   Synthetic members, listings and events; generates the seed
supabase/           Local Supabase config, migrations, seed and pgTAP tests
docs/               Specs, decisions, design concept, backlog
tools/              Helper scripts for the agent team
```

Later backlog items add the rest of the target layout in
[`docs/spec/architecture.md`](docs/spec/architecture.md): `sanity/`, `emails/` and the rest of
`scripts/`.

## Next.js 16 notes

- This project uses Next.js 16 with **Cache Components** and **Partial Prefetching** enabled
  (`next.config.ts`), and Turbopack for dev and build. Some APIs differ from older versions: read
  the docs bundled in `node_modules/next/dist/docs/` before relying on memory (see `AGENTS.md`).
- `next-env.d.ts` and the route types in `.next/` are generated by `next dev`, `next build` and
  `next typegen`. They're git-ignored; `pnpm typecheck` regenerates them first.
