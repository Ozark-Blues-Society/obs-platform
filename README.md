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
cp .env.example .env.local   # local Supabase settings; .env.local is git-ignored
pnpm dev
```

Then open <http://localhost:3000>. Signing in needs the local Supabase stack running (see
[Local Supabase](#local-supabase)); the public pages work without it. `.env.example` lists the
environment variables, set to the local stack's values. Typed validation of them arrives with
backlog item F-4. Never commit secrets.

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
well-known demo keys on every machine and only work against the local stack. `.env.example` holds
the two the app uses.

| Service                                             | Local address                                             |
| --------------------------------------------------- | --------------------------------------------------------- |
| API (REST, Auth, Storage)                           | <http://127.0.0.1:54321>                                  |
| Postgres                                            | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (database admin)                             | <http://127.0.0.1:54323>                                  |
| Mailpit (catches Auth emails such as sign-in links) | <http://127.0.0.1:54324>                                  |

The ports are fixed, so a machine runs one stack (project id `obs-platform`), and
`supabase db reset` resets it for everyone using it.

### Keep the stack off the network

Unless told otherwise, Docker publishes container ports on every network interface, so other
machines on your network can reach Postgres (as superuser, password `postgres`) and Studio (no
sign-in). To publish them on `127.0.0.1` only, put this in Docker's `daemon.json`
(`~/.config/docker/daemon.json` for rootless Docker, `/etc/docker/daemon.json` otherwise; Docker
Desktop edits it under Settings → Docker Engine):

```json
{
  "ip": "127.0.0.1",
  "default-network-opts": {
    "bridge": { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" }
  }
}
```

Then run `supabase stop`, restart Docker (that stops every container) and run `supabase start`.
`ip` covers Docker's default network and `default-network-opts` covers networks created after the
restart, including the one `supabase start` creates. An existing network keeps its old setting
until `supabase stop` removes it. On Linux, `ss -ltn | grep ':543'` should then list only
`127.0.0.1`. The factory server is set up this way.

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

## Sign-in (Supabase Auth)

Members sign in at `/sign-in`, with a one-click link sent by email or with a password, and sign
out from `/account`. `/account` is members-only (a placeholder until M-8 builds My Account).
Sign-in links never create accounts: people become members by joining.

Locally, every email Auth sends lands in Mailpit at <http://127.0.0.1:54324>; nothing leaves the
machine. Ask for a link for a fixture member (see the table above), open the email in Mailpit and
follow its link. Or sign in with the fixture password `obs-local-dev`.

How it fits together:

- **The sign-in email** is `supabase/templates/magic-link.html`, registered in
  `supabase/config.jsonc` (`auth.email.template.magic_link`). Its link goes to
  `{site_url}/auth/confirm` with a one-time token hash. That route (`app/auth/confirm/route.ts`)
  verifies it and starts the session, so a link opened on another device still works. After
  changing the template settings or `auth.site_url`, restart the stack (`supabase stop`, then
  `supabase start`); the data is kept.
- **Sessions** live in cookies. `proxy.ts` (Next.js 16's name for middleware) refreshes an expired
  session on every request before the page renders, and sends visitors who open `/account` to sign
  in first.
- **Server code** gets the member from `getCurrentUser()` or `requireUser()` in
  `lib/auth/user.ts`, and a Supabase client acting as the member from `createClient()` in
  `lib/supabase/server.ts`. Both read the request, so call them inside a `<Suspense>` boundary
  (Cache Components). Check the member in every page, Server Function and Route Handler that needs
  one; the proxy's redirect is a convenience, not the security check.

### Sign-in emails through Resend

Hosted Supabase projects send Auth emails through Resend's SMTP server, because Supabase's
built-in sender is heavily rate-limited. The settings are in `supabase/config.jsonc` under
`auth.email.smtp`, switched off there so local email stays in Mailpit. For a hosted project, enter
them in the Supabase dashboard (Authentication → Emails → SMTP settings):

| Setting      | Value                                           |
| ------------ | ----------------------------------------------- |
| Host         | `smtp.resend.com`                               |
| Port         | `465`                                           |
| Username     | `resend`                                        |
| Password     | a Resend API key with sending access            |
| Sender email | `noreply@mail.<Society domain>` (decision 0005) |
| Sender name  | `Ozark Blues Society`                           |

The address is on the `mail.` subdomain chosen in
[decision 0005](docs/decisions/0005-resend-sending-subdomain.md). Resend accepts it only once that
domain is verified in Resend, after the records in the
[Resend DNS guide](docs/launch/resend-dns-records.md) are added (decision 0004). Until then the
sender has to be `onboarding@resend.dev`, which reaches test addresses only (see Test mode below).

Also on the hosted project: paste the subject and HTML of `supabase/templates/magic-link.html`
into the Magic link email template, set the site URL to the site's address, and set the email
rate limit (Authentication → Rate limits) high enough for a busy sign-in day. Past that limit, no
more sign-in emails go out that hour, but the form still says "Check your email" (so it never
shows who is a member). The server logs a warning each time:
`A sign-in link wasn't sent (Supabase email rate limit)`. Creating hosted projects and Resend
accounts, and production settings, are human gates ([`docs/HUMAN_GATES.md`](docs/HUMAN_GATES.md)).

Test mode: `onboarding@resend.dev` delivers only to Resend's test addresses (such as
`delivered@resend.dev`) and the Resend account's owner, so it can't reach real members. To try
Resend from your machine, put a test API key in `supabase/.env` as `RESEND_API_KEY=...`
(git-ignored), set `"enabled": true` under `auth.email.smtp` without committing it, restart the
stack, and request a link for a user whose address is `delivered@resend.dev` (add one in Studio).
Resend's dashboard shows the delivery. Switch it off and restart again afterwards. With SMTP on,
the stack also applies `auth.rate_limit.email_sent` (2 an hour in `supabase/config.jsonc`), so the
third link in an hour isn't sent, though the form still says it was. Raise the limit locally
without committing it, or wait. (With SMTP off, the CLI sets that limit to 360000, which is why
Mailpit never hits it.)

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

## Continuous integration

GitHub Actions runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every pull request
into `develop` or `main`, and on every push to `develop`. One job installs dependencies, starts
local Supabase, and runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db` (pgTAP),
`pnpm build` and `pnpm test:e2e` (against the production build). Each check runs even when an
earlier one fails, and any failure fails the run. A new push to a pull request cancels its older
run. CI uses no secrets.

Local Supabase (CLI 3.4.0) starts in the background while lint, typecheck, the unit tests and the
Playwright browser install run. A fresh stack applies the migrations and `supabase/seed.sql`, so
the database and end-to-end tests see the fixture data. CI starts only Postgres, the API gateway,
Auth, the REST API and Mailpit. Studio, Storage, Realtime, Edge Functions and the logging services
stay off because no test uses them yet. A change that needs one of them in CI drops it from the
`--exclude` lists in `ci.yml`. The build and the end-to-end tests get the stack's URL and
publishable key from `supabase status`, as `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They're the well-known local demo values, not secrets.

To reproduce a CI run locally:

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test
supabase start && pnpm test:db
pnpm build && CI=1 pnpm test:e2e
```

CI's database is always fresh. To match it on a stack that's already running, run
`supabase db reset` first (see [Local Supabase](#local-supabase)).

When the end-to-end tests fail, the run keeps the Playwright HTML report for 7 days as the
`playwright-report` artifact. Fetch it with
`gh run download <run-id> -n playwright-report -D playwright-report`, then open it with
`pnpm exec playwright show-report`.

CI is a single job because the repository is private on GitHub's free plan: 2,000 Actions minutes
a month, with each job billed rounded up to the minute. A run takes about two minutes. Local
Supabase accounts for about one of them, mostly pulling its Docker images.

## Project layout

```
.github/        CI workflow (GitHub Actions)
app/            Next.js App Router: pages, layouts, route handlers
lib/            Server and shared code: Supabase clients, sign-in helpers
proxy.ts        Runs before every request: refreshes Supabase sessions
e2e/            Playwright end-to-end tests
scripts/        Synthetic fixtures (scripts/fixtures/) and the seed generator
supabase/       Local Supabase config, migrations, seed and pgTAP tests
docs/           Specs, decisions, design concept, backlog
tools/          Helper scripts for the agent team
```

Later backlog items add the rest of the target layout in
[`docs/spec/architecture.md`](docs/spec/architecture.md): `sanity/`, `emails/` and the rest of
`scripts/`.

## Design tokens

Colors, fonts, type sizes, spacing and radii come from the approved concept
(`docs/design/prototype.html`) and live in `app/globals.css` as Tailwind theme tokens. Use their
classes (`bg-canvas`, `text-muted`, `rounded-card`), never hex values or Tailwind's own palette; a
unit test fails on hard-coded colors. [`docs/design/tokens.md`](docs/design/tokens.md) lists the
tokens, the WCAG contrast of each color pair, and how to swap in the Society's real brand.

## Next.js 16 notes

- This project uses Next.js 16 with **Cache Components** and **Partial Prefetching** enabled
  (`next.config.ts`), and Turbopack for dev and build. Some APIs differ from older versions: read
  the docs bundled in `node_modules/next/dist/docs/` before relying on memory (see `AGENTS.md`).
- `next-env.d.ts` and the route types in `.next/` are generated by `next dev`, `next build` and
  `next typegen`. They're git-ignored; `pnpm typecheck` regenerates them first.
