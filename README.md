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
cp .env.example .env.local   # local Supabase and Sanity settings; .env.local is git-ignored
pnpm dev
```

Then open <http://localhost:3000>. Signing in needs the local Supabase stack running (see
[Local Supabase](#local-supabase)); the public pages work without it. `.env.local` holds the
environment variables (see [Environment variables](#environment-variables)). Never commit secrets.

## Environment variables

`.env.example` lists every variable the app reads, each with a one-line note, set to values that
work with the local stack. Copy it to `.env.local`, which git ignores (as it does every `.env*`
file except `.env.example`), then fill in what you need:

- `SUPABASE_SECRET_KEY`: the local stack's secret key, which `supabase status` prints as
  `SECRET_KEY`. The daily jobs and the emails to classifieds posters need it.
- The Sanity variables, once the Society's Sanity project exists (see
  [Connecting a Sanity project](#connecting-a-sanity-project)).
- `CRON_SECRET`, to run the daily jobs by hand (see [Daily jobs](#daily-jobs)).

Leave the rest as they are. An empty value means unset, and each feature stays off until its
variables are set: without the two Supabase variables the site runs without sign-in, without
`RESEND_API_KEY` emails go to Mailpit, and so on.

**Checked when the app builds or starts.** `lib/env/` checks every variable with zod, and
`next build`, `next dev` and `next start` run the check first (`next.config.ts`). A value that is
set but wrong, or half of a pair (`NEXT_PUBLIC_SUPABASE_URL` without
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or the other way round), stops them at once with a list of
the variables to fix. Code that needs a variable that isn't set names it when it runs, as in
"SITE_URL isn't set: links in emails need the site's address". Messages name variables, never
their values, since some values are secrets.

**Public and server-only.** Next.js writes the value of every variable named `NEXT_PUBLIC_` into
the JavaScript it sends to every visitor's browser, so those must never hold a secret. The app
reads them with `publicEnv()` (`lib/env/public.ts`), which works anywhere. The others are
server-only, and the secrets are among them: the app reads them with `serverEnv()`
(`lib/env/server.ts`), which imports `server-only`, so importing it into browser code fails the
build. The check also refuses a Supabase secret key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
ESLint stops app code from reading `process.env` itself (code outside the app, such as scripts,
passes `process.env` to `lib/env/schema.ts`).

| Variable                               | Kind        | What it's for                                         |
| -------------------------------------- | ----------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public      | Supabase's address: sign-in, member data and files    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public      | Supabase's publishable key (set both, or neither)     |
| `SUPABASE_SECRET_KEY`                  | Secret      | The service role, for the daily jobs and emails       |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`        | Public      | The Sanity project (a placeholder until there is one) |
| `NEXT_PUBLIC_SANITY_DATASET`           | Public      | The Sanity dataset: `development` unless set          |
| `SANITY_API_READ_TOKEN`                | Secret      | Reads the private datasets (decision 0001)            |
| `SANITY_API_HOST_STAND_IN`             | Server-only | End-to-end tests only: the stand-in for Sanity's API  |
| `SITE_URL`                             | Server-only | The site's own address, for links in emails           |
| `EMAIL_FROM`                           | Server-only | The address every email is sent from (decision 0005)  |
| `RESEND_API_KEY`                       | Secret      | Sends email through Resend; without it, Mailpit       |
| `MAILPIT_URL`                          | Server-only | The local stack's mail catcher (local addresses only) |
| `CRON_SECRET`                          | Secret      | Turns on the daily jobs (decision 0006)               |
| `MAILERLITE_API_KEY`                   | Secret      | Turns on the MailerLite member group sync             |
| `STRIPE_SECRET_KEY`                    | Secret      | Stripe's API: membership dues, test mode until launch |

Secrets are server-only. In CI, every variable is a test or made-up value (see
[Continuous integration](#continuous-integration)). Production's are set in the hosting
provider's settings by a human ([`docs/HUMAN_GATES.md`](docs/HUMAN_GATES.md), Production), and a
production build stops at once if one is wrong.

**Adding a variable:** add it to `PUBLIC_VARS` or `SERVER_VARS` in `lib/env/schema.ts`, with a
check if its form is known, to `.env.example` with a one-line note, and to the table above. A
public one also goes in the list in `lib/env/public.ts`: Next.js only builds in a public variable
that is written out in full. `lib/env/env-example.test.ts` fails until `.env.example` matches the
schema and leaves every secret empty.

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
- Functions that policies or triggers call go in the `private` schema, which the Data API doesn't
  expose. A SECURITY DEFINER function in `public` could be called by anyone at
  `/rest/v1/rpc/<name>`, and it would skip row level security.
- Every new table needs row level security, policies and pgTAP tests (see `CLAUDE.md`). Tests go in
  `supabase/tests/` as `<name>_test.sql`; `supabase test new <name>` writes a template.
- `supabase/tests/rls_baseline_test.sql` fails if any table in `public` has row level security
  off, any view there bypasses it (no `security_invoker`), or `public` holds a materialized view,
  a foreign table, or a function other than a trigger function (the API can't call those) that is
  SECURITY DEFINER or switches role in its SET clause (`set role = 'service_role'`). Materialized
  views and foreign tables can't have row level security, so keep them in a schema the API doesn't
  expose. Put a SECURITY DEFINER function in `private`, or make it SECURITY INVOKER: revoking
  EXECUTE doesn't count, because a later grant can undo it, and revoking it from PUBLIC leaves the
  grants Supabase's default privileges give anon and authenticated by name. A role switch runs the
  call as that role, and `service_role` skips row level security: drop the setting, or move the
  function to `private`. Don't switch role in a function body either (`set local role` or
  `set_config('role', ...)`): the test reads only the SET clause, and no check could catch every
  such switch (dynamic SQL gets past a source search), so reviewers read function bodies by hand.

### Fixtures and seed data

Synthetic data lives in `scripts/fixtures/`. Real member data never goes in the repo.

- `members.mts`: 40 members across the four levels and three statuses (active, expiring,
  lapsed), including the staff roles below.
- `listings.mts`: classifieds in every category and status.
- `events.mts`: events and venues. Events live in Sanity, so these go to Sanity's development
  dataset once the schemas exist (C-1).

`supabase/seed.sql` is generated from the fixtures by `pnpm fixtures:generate`, and `pnpm test`
fails if it's out of date. The seed loads only tables that exist: the members' sign-ins, their
profiles, the staff roles and the classifieds listings.

Every fixture member can sign in locally with their address (for example
`avery.collins@example.com`) and the password `obs-local-dev`. These four have staff roles (see
[Member profiles and staff roles](#member-profiles-and-staff-roles)):

| Role               | Fixture member              |
| ------------------ | --------------------------- |
| Administrator      | `avery.collins@example.com` |
| Membership Manager | `jordan.ellis@example.com`  |
| Editor             | `morgan.hale@example.com`   |
| Moderator          | `dale.ramsey@example.com`   |

## Sign-in (Supabase Auth)

Members sign in at `/sign-in`, with a link sent by email or with a password, and sign out from
`/account`. `/account` is members-only (a placeholder until M-8 builds My Account).
Sign-in links never create accounts: people become members by joining.

Locally, every email Auth sends lands in Mailpit at <http://127.0.0.1:54324>; nothing leaves the
machine. Ask for a link for a fixture member (see the table above), open the email in Mailpit,
follow its link and press **Finish signing in**. Or sign in with the fixture password
`obs-local-dev`.

How it fits together:

- **The sign-in email** is `supabase/templates/magic-link.html`, registered in
  `supabase/config.jsonc` (`auth.email.template.magic_link`). Its link goes to
  `{site_url}/auth/confirm` with a one-time token hash. That page
  (`app/(site)/auth/confirm/page.tsx`) has a **Finish signing in** button, which sends the token
  hash to `confirmSignIn()` in `lib/auth/actions.ts`. It verifies the token hash on the server and
  starts the session, so a link opened on another device still works. After changing the template
  settings or `auth.site_url`, restart the stack (`supabase stop`, then `supabase start`); the
  data is kept.
- **Why the button:** some mail systems open the links in incoming email before the member does,
  to scan them: link scanners such as Microsoft Defender Safe Links, and some gateways and link
  previewers. If opening the link verified the token, the scan would use it up, and the member
  would be told the link had expired or was already used. Scanners load the page but don't press
  its button, so the link still works for the member. Don't make the page submit the form by
  itself: scanners that run scripts would then use the link up again. Supabase's
  [Auth email templates guide](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching)
  describes the problem ("Email prefetching").
- **Sessions** live in cookies. `proxy.ts` (Next.js 16's name for middleware) refreshes an expired
  session on every request before the page renders, and sends visitors who open `/account` or an
  admin screen (`/admin`) to sign in first.
- **Server code** gets the member from `getCurrentUser()` or `requireUser()` in
  `lib/auth/user.ts`, and a Supabase client acting as the member from `createClient()` in
  `lib/supabase/server.ts`. Both read the request, so call them inside a `<Suspense>` boundary
  (Cache Components). Check the member in every page, Server Function and Route Handler that needs
  one; the proxy's redirect is a convenience, not the security check.

### Passwords

Members set or change their password at `/account/password`, linked from My Account. Members who
join online or are imported start without one and sign in with email links until they set one. A
member who forgot their password signs in with an email link and sets a new one there; the sign-in
page says so under the password form. There's no separate reset email: the sign-in link already
proves the member owns the address.

- **The form** (`app/(site)/account/password/`) calls `setPassword()` in `lib/auth/actions.ts`. It checks
  the session again, then calls Supabase Auth's `updateUser({ password })` as the member. Supabase
  then ends the member's other sessions. A device that's already signed in keeps working until its
  access token runs out (at most an hour, `auth.jwt_expiry`), then has to sign in again.
- **The rules:** 8 to 72 characters, typed twice (`checkNewPassword()` in
  `lib/auth/password-state.ts`). Supabase Auth refuses passwords over 72 bytes, and ones shorter
  than `auth.minimum_password_length` in `supabase/config.jsonc`. A unit test keeps that setting
  equal to the form's minimum. Restart the stack after changing it.
- **Hosted projects:** set Minimum password length to 8 (Authentication → Sign In / Providers →
  Email). Leave Secure password change off. With it on, a member signed in for more than a day is
  told to sign out and in again before they can change their password. Leave Require current
  password when updating off as well: the form doesn't ask for the current password (members who
  sign in with email links may not have one to give). With it on, a member who signed in with their
  password is told to sign out and in again with an email link before they can change it.
- **End-to-end tests** that change a fixture member's password put it back afterwards with
  `restorePassword()` (`e2e/support/supabase-auth.ts`), because other tests and
  `supabase/tests/seed_test.sql` expect the fixture password.

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

## Member profiles and staff roles

Each member has a row in `profiles`: name, address, phone, membership level, status, expiry date,
auto-renew. Staff roles are rows in `user_roles`: `admin`, `membership_manager`, `moderator` or
`editor`. The tables come from `supabase/migrations/20261126050904_profiles_and_roles.sql`, and
`supabase/tests/profiles_test.sql` tests who can read and change what. There are no households:
the board created no family memberships (board decisions §2).

| Who                                  | `profiles`                                     | `user_roles`                        |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------- |
| A visitor                            | nothing                                        | nothing                             |
| A member, moderators and editors too | reads their own; changes their name and phone  | reads their own                     |
| An administrator                     | reads every profile; changes their name, phone | reads, gives and removes every role |
| A membership manager                 | reads every profile; changes their name, phone | reads their own                     |
| Server code using the service role   | everything                                     | everything                          |

- **Signing up creates the profile.** A trigger on `auth.users` copies the address, plus
  `first_name` and `last_name` from the sign-up's user metadata (`options.data` in
  `supabase.auth.signUp`). Level, status and the dates stay empty until the first payment. When a
  member changes their address through Supabase Auth, the profile follows.
- **Members can't change their membership.** Level, status, `expires_at`, auto-renew, the Stripe
  customer, `joined_at` and the staff notes are written by server code with the service role (the
  Stripe webhook, scheduled jobs, the importer). Column privileges block a member's own update of
  them, whatever the policies say. Members can read their own staff notes.
- **Role checks** in policies call `private.has_role(...)`, in the `private` schema (see
  [Migrations and database tests](#migrations-and-database-tests)).
- **Giving and removing roles:** administrators do it on the Roles screen, `/admin/roles`
  (`app/admin/roles/`, with its Server Functions in `lib/admin/roles-actions.ts`; the
  administrators' how-to is [`docs/volunteer-guide/roles.md`](docs/volunteer-guide/roles.md)). It acts as the
  administrator: the policies in `supabase/migrations/20261126071148_roles_management.sql` let only
  administrators insert and delete `user_roles` rows, and nobody can update one.
  `supabase/tests/user_roles_test.sql` tests them. The local seed gives each role to a fixture
  member (see [Fixtures and seed data](#fixtures-and-seed-data)).
- **There's always an administrator.** A trigger refuses to remove the last one, whoever tries: an
  administrator, server code with the service role, or deleting their account (deleting that user
  in Supabase Auth fails). Its error code, `OB001`, is what the Roles screen explains. Removals take
  turns (an advisory lock), so two administrators can't remove each other at the same moment.
- **A new project's first administrator** gets the role in SQL, because only an administrator can
  give roles. Once they've signed in, run this in the Supabase dashboard's SQL Editor:
  `insert into public.user_roles (profile_id, role) select id, 'admin' from public.profiles where email = '<their address>';`
  Setting up the production project is a human gate ([`docs/HUMAN_GATES.md`](docs/HUMAN_GATES.md)).
- **End-to-end tests** never give anyone the Administrator role: the test of the last
  administrator needs the fixture administrator to be the only one. They take back any role they
  give (`removeRole()` in `e2e/support/supabase-roles.ts`), because
  `supabase/tests/seed_test.sql` expects the fixture roles.

## Content Studio (Sanity)

Editors manage the site's content in the Content Studio at `/studio`: Sanity Studio, embedded in
the app (`sanity.config.ts`, `app/studio/[[...tool]]/page.tsx`). The content lives in Sanity's
hosted Content Lake, with no local copy, so local development connects to a Sanity project's
`development` dataset, never the production one. Editors' instructions are in
[`docs/volunteer-guide/`](docs/volunteer-guide/).

### Connecting a Sanity project

The Society's Sanity project doesn't exist yet. Creating Sanity projects, datasets and tokens is a
human gate ([`docs/HUMAN_GATES.md`](docs/HUMAN_GATES.md); due Dec 3 in decision 0002). Until a
project is connected, leave the Sanity variables in `.env.local` empty. The app then uses the
project ID `placeholder`: it builds and runs, `/studio` shows Sanity's "Project not found" screen,
and no content loads.

With a project, set these in `.env.local`:

| Variable                        | Value                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | The project's ID, from [sanity.io/manage](https://www.sanity.io/manage) |
| `NEXT_PUBLIC_SANITY_DATASET`    | `development` (the default)                                             |
| `SANITY_API_READ_TOKEN`         | A token with the Viewer role (Manage → API → Tokens). It's a secret.    |

Then, in Manage → API → CORS origins, add `http://localhost:3000` with "Allow credentials" ticked,
so the Studio can sign in from there. Every address that serves the site needs that entry.

### How it fits together

- **Private datasets** (decision 0001). Sanity answers anonymous queries on a private dataset as if
  it were empty, so the server reads everything, published or draft, with the read token
  (`sanity/live.ts`). The token never reaches the browser: it has no `NEXT_PUBLIC_` name, and
  `defineLive` gets `browserToken: false`.
- **Content model** (`sanity/schemas/`, backlog C-1): one file per document type in `documents/`
  (page, event, post, sponsor, sponsorTier, venue, directoryEntry, person, siteSettings), the
  page blocks in `page-blocks.ts`, shared objects in `objects/` (visibility, link, rich text),
  fixed choices in `options.ts` and custom validation in `validation.ts`. Volunteers' steps are in
  the guide's editing pages. When you change it:
  - Give every field a plain-language `description` for volunteers. `schemas.test.ts` fails
    without one.
  - Pages, posts and events carry `visibility`: `audience` is `everyone`, `members` or `levels`,
    with `levels` holding membership levels. M-7 gates on it on the server (decision 0001).
  - Venues are public: event pages and the ICS feed show them. Directory details and the
    `bookingContact` object live on `directoryEntry`. Select `bookingContact` only for Band,
    Business and Sponsor members (M-9), and never fetch directory entries with `...`.
  - Site settings is a singleton (document ID `siteSettings`, registered under
    `document.singletons` in `sanity.config.ts`). Its benefits table starts as board-decisions §1.
  - Web addresses: pages at `/<slug>`, events at `/events/<slug>`, posts at `/blog/<slug>`
    (`sanity/paths.ts`, which the Presentation tool uses too). A page can't take a slug from
    `RESERVED_PAGE_SLUGS`, and a test keeps that list in step with the routes in `app/`.
  - Event start times and post dates are entered in Central Time (`SOCIETY_TIME_ZONE`) and stored
    in UTC.
  - `schemas.test.ts` and `sanity/studio-config.test.ts` run Sanity's own schema compiler,
    document validation and Studio configuration (`createWorkspaceFromConfig`) with a stand-in
    client, so they need no Sanity project.
- **Live preview.** The Studio's Presentation tool shows the site next to the document being
  edited. It opens `/api/draft-mode/enable` with a secret, which the route checks with Sanity before
  turning on Next.js draft mode. In draft mode, pages read drafts (`getDynamicFetchOptions()` in
  `sanity/live.ts`), text carries invisible markers that make it clickable for editing, and the page
  re-renders each time the Studio reports an edit (`app/(site)/draft-mode/visual-editing.tsx`).
- **Shared preview links.** The Presentation tool's share button turns on a link with a long-lived
  secret. Anyone who has it sees drafts without a Studio login, under a banner with an "Exit
  preview" button. Turning sharing off and on again stops old links working. Draft mode is not a
  membership: members-only content must stay locked for a draft-mode visitor (M-7).
- **Published changes.** `<SanityLive>` in `app/(site)/layout.tsx` listens for them and refreshes
  cached content. It needs no token, only the site's address in the CORS origins.
- **Pages built in the Studio** (backlog C-2) live at `/<slug>`: `app/(site)/[slug]/page.tsx`
  reads one with `getGatedItem("page", slug, PAGE_CONTENT)` and `ContentPage`
  (`components/templates/content-page.tsx`) draws it in its template. `lib/pages/blocks.ts`
  checks each block and turns it into the props of its component in `components/blocks/` (the
  map is in [`docs/design/approval-package.md`](docs/design/approval-package.md)). A block of an
  unknown type, or one that isn't complete yet, such as a draft's photo block with no photo, is
  left out. A hero as the first block opens the page instead of the page header. A viewer who may
  not see the page gets its header (title and intro, which are public) and `<MembersOnlyLock>`.
  - Photos come from Sanity's image CDN through next-sanity's `<Image>`, which applies the
    editor's crop and focal point (`components/blocks/sanity-image.tsx`). Videos play in
    YouTube's privacy-enhanced player, Vimeo's with tracking off, or Bandcamp's player, from an
    address built from the video's id (`lib/pages/video.ts`, which the Studio's link check uses
    too).
  - The blocks that fill themselves load their content with their own calls, never through the
    page's query. Sponsor logos: `listCurrentSponsors` (`sanity/content/sponsors.ts`; sponsors
    are public) gives the editor's picks or every current sponsor, never one past its last day
    (`endsAt`, a Central Time date), cached per day like the menus, and
    `components/blocks/current-sponsors.tsx` draws them. Upcoming events wait for P-2's events
    loader, the venue directory for M-9's and the volunteer form for P-5. Until then they show
    nothing.
  - `[slug]` matches every address without a page of its own, so ESLint's
    `@next/next/no-html-link-for-pages` now flags any `<a href="/…">` written as a literal. Use
    `next/link`, or pass the address as an expression where a plain `<a>` is deliberate, as
    `<MemberFiles>` does.
  - An address with no page streams the not-found page with status 200 (the shell is already
    sent), and Next.js adds `noindex` so search engines skip it. `e2e/pages.spec.ts` checks this
    along with each template, the blocks and members-only pages.
- **The blog** (backlog P-3) is at `/blog`. `app/(site)/blog/page.tsx` lists posts with
  `listGatedItems("post", POST_LIST_CONTENT, { order: POST_LIST_ORDER })`, and `selectBlogPage`
  (`lib/blog/posts.ts`) keeps the posts that are out, in the category from `?category=`, 12 to a
  page (`?page=`). A later `publishedAt` schedules a post: the list leaves it out and its page is
  not found until then, except in a preview. That check runs on every request rather than in the
  cached GROQ answer, so a scheduled post shows the minute it's due without anyone publishing
  again. The category pills are links (`PillLinks`), so each filter has its own address and the
  tab title names it.
  - The post page (`app/(site)/blog/[slug]/page.tsx`, drawn by `components/blog/post-view.tsx`)
    shows the cover photo, the post's text (`RichText`), its files and its author from People
    (`POST_CONTENT`). A locked post shows only its headline, category, date and cover photo, as its
    card does, then `<MembersOnlyLock>`.
  - `e2e/blog.spec.ts` covers the list, the category filter, a post, scheduled posts and the locks
    (`e2e/members-only-items.spec.ts` has the post page's locks in depth).
- **Pages that show Sanity content** go under `app/(site)/`, the route group that holds the
  draft-mode tools; the Studio stays outside it. They read pages, posts and events through
  `sanity/content` (see [Members-only content](#members-only-content)). Inside `sanity/`, call
  `sanityFetch` inside a `"use cache"` function and resolve `getDynamicFetchOptions()` outside it,
  as in Sanity's guide
  [Sanity Live with Next.js Cache Components](https://www.sanity.io/docs/nextjs/cache-components).
- **Sponsors** (backlog P-4): `/sponsors` (`app/(site)/sponsors/page.tsx`) shows the featured
  sponsor's spotlight, then every current sponsor grouped by tier (`components/sponsors/`). The
  home page's sponsor band (`components/home/home-sponsors.tsx`) shows the same spotlight and
  every current sponsor's logo. Both read `listCurrentSponsors([])`, so a sponsor leaves both the
  day after its `endsAt`. Tiers are data in the Studio (board decisions §8): `groupSponsorsByTier`
  orders them by their order field, then name, and a tier's logo placement applies on the Sponsors
  page only. The Studio allows one featured sponsor at a time, but its check can be stale when a
  sponsor is published, so `pickFeaturedSponsor` takes the one changed most recently
  (`_updatedAt`), then the lowest id.

## Members-only content

Any page, post or event can be limited to members, or to some membership levels (decision 0001,
backlog M-7). The rules are in `lib/members/access.ts`:

- `everyone`: anyone. `members`: any member whose membership is active. `levels`: an active member
  at one of the ticked levels. A missing or unknown audience is open to nobody.
- A membership is active while `profiles.expires_at` is in the future. Access ends at expires_at,
  with no grace period (board-decisions §4).
- Draft mode (Studio previews and shared preview links) never counts as a membership.

**Reading content.** Pages, posts and events are read only through `sanity/content`:

```ts
const post = await getGatedItem("post", slug, "{ excerpt, body }");
// post.access: { allowed: true }, or { allowed: false, reason: "sign-in" | "join" | "renew" | "level" }
// post.content: { excerpt, body } when allowed, otherwise null
```

- The loader first works out who is viewing (`getViewer()` in `lib/members/viewer.ts`: the session,
  then the member's own profile row). It then asks Sanity with the viewer's active level as
  `$memberLevel`. The query (`sanity/content/gated-query.ts`) fills in `content` only when that
  level can see the item, so the item's members-only fields never leave Sanity for anyone else.
  The loader then checks again with `checkAccess`.
- Each type's public fields are fixed in `PUBLIC_FIELDS`, after the approved concept. A locked post
  shows its headline, category, date and cover photo, a locked event its title, date, time, prices
  and photo (not the venue), and a locked page its title and intro. Everything else goes in
  `content`.
- `listGatedItems(type, content, { filter, params, order, limit })` does the same for lists, feeds
  and sitemaps. `listPublicItems` takes the same arguments but always asks as a visitor, for
  published content only, whoever is signed in and even in a preview: for what goes out to
  everyone, such as the monthly email digest.
- The gate covers the item a loader returns, not other documents its GROQ reads. So `content`,
  `filter` and `order` are fixed strings in the code. Values go in `params`, never built from
  request input. And:
  - No `*` outside quotes: the loaders refuse it, because a query of the whole dataset reads other
    documents without their gates. Load other pages, posts and events, and the lists that fill a
    block (upcoming events, sponsor logos, the venue directory), with their own loader call. They
    refuse `documents::` functions too: `documents::get()` follows a reference the way `->` does.
  - A dereference (`->`) skips the target's gate. Venues, people and sponsors can be dereferenced
    freely. From a page, post or event (`link.internal`), take only `LINK_TARGET`:
    `{ _type, "slug": slug.current, title }`. In `content`, each `->` needs a projection that lists
    the fields it reads. The loaders refuse `internal->`, `internal->{ ... }`, and a bare `@` or `^`
    inside the projection, where it stands for the whole other document: `internal->{ "doc": @ }`,
    `internal->{ true => @ }`, `internal->{ "x": body[]{ "doc": ^ } }`. `@.slug.current` and
    `@{ title }` list fields, and the `@` in an array filter (`tags[@ != "x"]`) is the element.
  - `filter` and `order` use public fields only: a filter on a members-only field answers questions
    about it, and an order on one leaks its ranking.
- Loaders run at request time and read the session, so call them inside `<Suspense>`. Results are
  cached per query, viewer level and preview mode, never per person, so a visitor never gets an
  entry a member's visit filled.
- ESLint refuses `sanityFetch`, the Sanity `client` and `createClient` anywhere else, and any
  dynamic `import()` of their modules (`eslint.config.mjs`; `sanity/content/lint-guard.test.ts`
  proves the rule works). The menus
  (`sanity/site-chrome.ts`: public page titles and links) and the draft-mode route are the only
  exceptions. Put new reads in `sanity/content/`.

**The venue directory** (backlog M-9) is read with `listDirectory()` in `sanity/content/directory.ts`,
whatever page shows it (`components/blocks/venue-directory.tsx`):

- Its rows, the Directory entries, go only to members whose membership is active. For anyone else
  the loader doesn't ask Sanity, and the query itself returns no entries when `$memberLevel` is null.
- The query selects an entry's booking contact only when `$memberLevel` is in
  `BOOKING_CONTACT_LEVELS` (`lib/members/access.ts`: Band, Business and Sponsor, board-decisions §1),
  and the loader drops contacts again for every other level.
- A venue holds only public fields (name, address, map link), so an event that dereferences
  `venue->` can't reach a contact. Read Directory entries only through `listDirectory()`: never with
  `...`, and never from another document's query.

**Checking the dataset is private.** `pnpm check:dataset` asks Sanity, without a token, for
anything in the dataset named in `.env.local`, and fails (exit 1) if it gets any of it back, naming
members-only pages, posts, events and Directory entries and counting booking contacts. Sanity
answers an anonymous query on a private dataset with 200 and an empty result, so the check reads the
result, not the status. With `SANITY_API_READ_TOKEN` set, it also confirms there is published
content to find; it exits 2 when it can't tell. Run it when a dataset is created or the plan
changes: a lapsed trial or a downgrade turns private datasets public. The launch runbook (Q-5) runs
it against production.

### Members-only files

Files only members may download (PDFs, documents, audio) live in the private Supabase Storage bucket
`member-files`, never in Sanity, which serves every upload publicly by URL, even from a private
dataset (decision 0001). The migration is `supabase/migrations/20261126083600_member_files.sql`:

- Each file has a row in `public.member_files`: its title, its object in the bucket
  (`<id>/<file name in safe characters>`), the name it downloads as, and who may download it:
  `members` (any active member) or `levels` with the levels listed. Never everyone: public files
  belong in Sanity.
- Row level security and the Storage policies apply the same rule as pages
  (`private.has_member_access`). A member reads the row of, and can download, list or sign a link
  to, only the files their active membership allows. Visitors get nothing. Editors and
  administrators add and remove files and see them all. Nobody changes a file in place.
- The site's link to a file is `/files/<id>` (`app/files/[id]/route.ts`). It sends visitors to sign
  in and back, checks the member's access again with `checkAccess`, then redirects to a Storage link
  signed as the member, which works for 60 seconds and downloads the file. Members who may not have
  it get a short page saying why (renew, join, or not available to them). Nothing is cached.
- Tests: `supabase/tests/member_files_test.sql` (every audience and level, the `expires_at`
  boundary, editors, and moderators and membership managers, whose roles give them no files) and
  `e2e/member-files.spec.ts` (Supabase's REST and Storage APIs as a visitor, a lapsed member, a
  member at the wrong level and an allowed one, then the download link). CI starts Storage for them.
- **Adding files.** Editors and administrators upload them at `/admin/files`
  (`app/admin/files/`, Server Functions in `lib/admin/member-files-actions.ts`). The browser sends
  the file straight to Storage through a one-time upload link the server makes for them, so large
  files never pass through the website's server (hosts cap request sizes). Then the server checks
  Storage has it and adds its row, which is what lets members download it. Removing deletes the row
  first, so access ends at once, then the file. Volunteers' steps:
  [`docs/volunteer-guide/members-only-files.md`](docs/volunteer-guide/members-only-files.md).
- **Showing the lock.** `<MembersOnlyLock>` (`components/members/members-only-lock.tsx`) is what a
  viewer who may not see an item gets, worded for `access.reason`: sign in or join, join, renew, or
  which levels it's for. It wraps D-3's `LockOverlay`. The post page
  (`app/(site)/blog/[slug]/page.tsx`) shows how the pieces fit, and `e2e/members-only-items.spec.ts`
  proves it for a visitor, a member, a member at another level and a lapsed member: the lock, and
  no members-only text in the HTML or the RSC payload, even right after a member's visit or in a
  preview.
- **Attaching files.** Pages, posts and events have a `memberFiles` field: link text and the file's
  code (its id). Put `memberFiles[]{ title, fileId }` in the item's members-only `content` and render
  it with `<MemberFiles>` (`components/members/member-files.tsx`), which links each one to
  `/files/<id>` with plain `<a>` tags: `next/link` would prefetch them and mint download links.

## Classifieds listings

Active members, at any level, post listings in the five categories at `/account/listings/new`
(backlog K-1, board decisions §7: `app/(site)/account/listings/new/`, with its Server Functions in
`lib/listings/listing-actions.ts`). The table, the photo bucket and their rules come from
`supabase/migrations/20261126210923_listings.sql`. `supabase/tests/listings_test.sql` tests who can
do what, and `e2e/listings.spec.ts` tests the form.

| Who                                            | `listings`                                                                                 | Photos (bucket `listing-photos`)                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| A visitor                                      | reads live listings until their `expires_at`                                               | sees live listings' photos                                |
| An active member                               | reads live listings and all their own; submits; changes what they wrote; deletes their own | uploads into their own folder; sees and removes their own |
| A member whose membership ended, or never paid | reads live listings and all their own; deletes their own; can't submit or change them      | sees their own                                            |
| Moderators and administrators                  | read every listing; change its status and `reject_reason`, never what the poster wrote     | see every listing's photo                                 |
| Server code using the service role             | everything                                                                                 | everything                                                |

- **A new listing waits for a moderator.** It starts `pending` whatever the request says: members
  can't insert the status or the dates. Approving it (`status` `live`) sets `approved_at`, and
  `expires_at` 60 days later. A poster's change sends a listing back to `pending`, so nothing
  reaches the public unreviewed. Nobody sees a live listing after its `expires_at`, even before the
  daily job (K-4) marks it `expired`.
- **Who may change which columns** is checked by a trigger, `private.check_listing_change()`:
  posters and moderators are the same database role, so row level security alone can't tell their
  changes apart. Server code with the service role isn't limited by it.
- **Photos** go in the private bucket `listing-photos`: JPEG, PNG or WebP, up to 10 MB. As with
  members-only files, the browser uploads the photo straight to Storage through a one-time link the
  server makes, then the server checks Storage has it and adds the listing. A photo's name is
  `<profile id>/<random id>.<jpg|png|webp>`, and a listing can show only a photo in its poster's
  folder, so no listing can make another member's upload public. A photo is visible to whoever can
  read a listing that shows it: anyone, visitors included, can sign a link to a live listing's
  photo, but only the poster and the moderators to a pending one's. A photo stays while a listing
  shows it.
- **A listing shows only the photo the moderators saw.** A listing can name only a photo already in
  Storage, and it keeps the object's version (`photo_version`, set by the trigger
  `private.pin_listing_photo()`). The Storage policy shows the photo only while the object is still
  that version. Storage's API won't overwrite a photo, but an upload link made with `x-upsert` can
  replace its object for two hours, past the policies. A replaced photo stops showing, to visitors
  and moderators alike, until the poster submits a new one, which goes back to the moderators. A
  signed link checks the policies only when it's made, so sign photo links for the listing's
  version, `createSignedUrl(path, expiresIn, { versionId: photo_version })`: a link without it
  keeps serving a replaced photo until it expires.
- **Contact preference:** `email`, where people write through the website and the poster's address
  stays private (K-3 builds that), or `phone`, the number on the poster's profile. The form offers
  phone only when the profile has a number.
- **The fixture listings** (`scripts/fixtures/listings.mts`) are the seed's last section. To load
  them into a database that got the migration with `supabase migration up` (no reset), run
  `awk '/^-- Classifieds listings\./,0' supabase/seed.sql | docker exec -i supabase_db_obs-platform psql -U postgres -v ON_ERROR_STOP=1`.
  Loading them again changes nothing.
- Still to come: the public listings (K-3), and expiry with "My listings" (K-4).

### Moderation

Moderators and administrators approve or reject listings in the classifieds queue at
`/admin/classifieds` (backlog A-3 and K-2: `app/admin/classifieds/`, with its Server Functions in
`lib/listings/moderation-actions.ts`). It lists the pending listings oldest first, with their
details, photos and posters' first names and last initials. Moderators can't read profiles, so the
names, and the addresses the emails go to, are read with the service role (`SUPABASE_SECRET_KEY`),
only after the moderator's role has been checked.

- **Approve** makes the listing `live`, which starts its 60 days. **Reject** makes it `rejected`,
  with the moderator's reason, which the database requires (the `listings_rejected_reason` check).
  Either way the poster gets the listing-approved or listing-rejected email through
  `getEmailSender()`: Mailpit locally and in the tests, never real people. If the email fails, the
  decision stands and the moderator is told the poster wasn't emailed.
- **A decision applies to the version the moderator saw.** `listings.revision` counts the versions
  of what the poster wrote: `private.check_listing_change()` adds one with each change, whoever
  makes it, and ignores anything else written to it. The queue sends back the revision it showed,
  and the decision changes the listing only while it's still pending at that revision. A change the
  poster makes while the moderator looks (the listing stays pending) is never approved unseen: the
  moderator is told, and the queue shows the new version. The same check keeps two moderators from
  deciding on one listing twice.
- Photo links are signed for the listing's `photo_version`, so the moderator sees the photo that
  would go live. A photo replaced in Storage since doesn't sign, and the queue says so.
- `supabase/tests/listing_moderation_test.sql` tests the revision and the reason rule,
  `lib/listings/moderation*.test.ts` the Server Functions and the queue's reads, and
  `e2e/admin-classifieds.spec.ts` the queue against the local stack and Mailpit. The guide for
  moderators is `docs/volunteer-guide/classifieds-moderation.md`.

## Emails (React Email)

The app's own emails (backlog E-1) are [React Email](https://react.email) templates in `emails/`.
Sign-in emails belong to Supabase Auth (see [Sign-in](#sign-in-supabase-auth)).

| Template                    | Sent when                                  | Sent by                                         |
| --------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `welcome.tsx`               | Someone joins                              | Stripe webhook (M-5)                            |
| `receipt.tsx`               | A dues payment, online or by check or cash | Stripe webhook (M-5), recording a payment (A-1) |
| `renewal-reminder.tsx`      | 30 days before a membership ends           | Daily email job (E-2)                           |
| `renewal-last-reminder.tsx` | 7 days before it ends                      | Daily email job (E-2)                           |
| `membership-lapsed.tsx`     | Once, 14 days after it ended               | Daily email job (E-2)                           |
| `listing-approved.tsx`      | A moderator approves a listing             | Moderation (K-2)                                |
| `listing-rejected.tsx`      | A moderator rejects one, with a reason     | Moderation (K-2)                                |
| `listing-expiring.tsx`      | 5 days before a listing expires            | Listing expiry (K-4)                            |
| `monthly-newsletter.tsx`    | Once a month, by the newsletter writer     | MailerLite (the Monthly digest screen, E-4)     |

Stripe also emails its own receipt for online payments (decision 0002), and its own notices to
members on yearly auto-renew, who get no renewal reminders. Each of the site's own emails is about
the recipient's own membership, payment or listing and promotes nothing, so none has an unsubscribe
link. The lapsed
note says that the membership has ended and how to renew, with no offers (Q-20261126-104811-8667
asks Parker to confirm; a promotional email would also need the Society's postal address and an
opt-out).

```bash
pnpm email:preview   # preview server at http://localhost:3030
```

The preview shows each template with its sample props (`PreviewProps`), at desktop and phone
width, as HTML and as plain text, and reloads as you edit. It also sends the rendered sample to
React Email's spam checker at react.email, one more reason the sample props stay synthetic: never
put real member data in them. Don't use the preview's **Send** button: it emails whatever address is
typed through React Email's own service, outside Resend's test mode, which could reach a real
person (`CLAUDE.md`: never email real people). To see an email arrive, send it locally, where it
lands in Mailpit (see "Sending" below).

- **Templates** get everything they show as props, so they never fetch anything or read the
  environment. Each file's default export is the component, with a `subject` function and
  `PreviewProps` attached. The layout (`emails/_components/layout.tsx`: a header with the logo, a
  card for the content, a footer) and the pieces in `emails/_components/ui.tsx` are shared, for the
  later templates to reuse. The preview lists every `.tsx` file in `emails/` except those in
  folders that start with `_`.
- **Sending.** `renderEmail(template, props)` (`emails/render.ts`) returns the subject, the HTML and
  the plain-text version, and the sender that `getEmailSender()` (`lib/email/send.ts`) returns
  sends them. It works in Route Handlers. Links in an email must be absolute, so every template
  takes the site's address as `siteUrl` (the `SITE_URL` setting). The sender's address isn't in the
  templates: every email leaves from `EMAIL_FROM` with the name "Ozark Blues Society" (decision
  0005: `noreply@mail.<Society domain>`, `onboarding@resend.dev` in test mode). With
  `RESEND_API_KEY` set, emails go through Resend, with an idempotency key when the caller gives one
  (Resend then delivers a repeat of it within 24 hours only once). Without it, they go to Mailpit at
  `MAILPIT_URL` (in `.env.example`), next to the sign-in emails, and never leave the machine;
  `MAILPIT_URL` must be a local address. Nothing in `emails/` sends email; the backlog items in the
  table above do.
- **Links.** The renewal emails link to the Join page, where members renew (M-4). The listing
  emails link to My listings and the classifieds, at `MY_LISTINGS_PATH` (`/account/listings`, K-4)
  and `CLASSIFIEDS_PATH` (`/classifieds`, K-3) in `lib/site/navigation.ts`, which K-3 and K-4 build.
- **Brand.** Email clients can't read the site's CSS variables, so `emails/_lib/theme.ts` copies
  the token values. A unit test fails when a copy no longer matches `app/globals.css`, or when a
  color pair the emails use falls below WCAG AA. Most email clients don't load web fonts (and
  loading them from Google would tell Google who opened an email), so headings fall back to
  Georgia and text to Arial. The logo is a placeholder, the Society's name, until the real logo
  arrives; it will be an image at an absolute address on the site.
- **Data.** Dates show in Central Time (`SOCIETY_TIME_ZONE`), amounts are in cents (Stripe's unit),
  and level names come from `MEMBERSHIP_LEVELS` (`sanity/schemas/options.ts`). The welcome email's
  benefits are the site settings' benefits table rows for the member's level. Listing titles and
  moderators' notes appear as their authors wrote them, as text (never markup); each line of a note
  becomes a paragraph.
- **Footer.** It says why the email was sent. Replies to a no-reply address go nowhere, so it
  links to the contact page (`/contact`, backlog P-7) instead.
- **Tests.** `emails/welcome.test.ts`, `emails/receipt.test.ts`, `emails/renewal.test.ts` (both
  reminders and the lapsed note), `emails/listing.test.ts` and `emails/monthly-newsletter.test.ts`
  render each template. `emails/templates.test.ts` checks every template it finds (one title, the
  language, absolute links, token colors only, a plain-text version with no gaps), so it covers a
  new template without changes; a newsletter must be listed in its `NEWSLETTERS`.
  `e2e/emails.spec.ts` loads each email in the browser at desktop and 390px width.

### The monthly newsletter

Once a month the newsletter writer (an editor or administrator) makes the newsletter on the
**Monthly digest** screen, `/admin/digest` (backlog E-4; steps for volunteers in
[`docs/volunteer-guide/monthly-digest.md`](docs/volunteer-guide/monthly-digest.md)). The site
doesn't send it: the writer copies its HTML and pastes it into MailerLite's custom HTML editor, and
MailerLite sends it to the mailing list, which has people who aren't members.

- **Posts.** The month's blog posts marked "Include in the monthly email digest", published in that
  month on the Society's calendar and up to now, latest first (`lib/newsletter/digest.ts`). They're
  read with `listPublicItems`, as a visitor sees them, so a members-only post comes with its
  headline and a link to sign in, never its summary, whoever makes the digest.
- **Template.** `emails/monthly-newsletter.tsx`, in the same layout as the site's emails, with a
  footer of its own: MailerLite's link variables `{$unsubscribe}` and `{$url}` (the web version),
  which MailerLite fills in for each subscriber, and the mailing address from Site settings, which
  MailerLite's terms ask for. Until the address is there, the footer shows a placeholder and the
  screen warns. The preheader is in the HTML, where MailerLite's custom HTML editor expects it. A
  busy month stays far below the 102 KB at which Gmail clips an email (a test checks 20 posts).
- **The screen** checks the role, lists the month's posts, shows the newsletter in a sandboxed
  frame and copies its HTML to the clipboard. Every MailerLite plan has the custom HTML editor
  (pricing page, checked 2026-11-26). The newsletter needs no MailerLite API key: the site sends
  MailerLite nothing for it. It can go to the mailing list or to the member groups the site keeps
  in MailerLite ([below](#mailerlite-member-groups)).

## Daily jobs

Once a day, at 13:00 UTC (7 AM in the Ozarks in winter, 8 AM in summer), Netlify runs the scheduled
function `netlify/functions/daily-jobs.mts`, on the production deploy only. It calls
`POST /api/cron/daily` (`app/api/cron/daily/route.ts`) with the secret `CRON_SECRET`, and the route
runs `runDailyJobs()` (`lib/jobs/daily.ts`). Why Netlify, and the options it was chosen over:
[decision 0006](docs/decisions/0006-daily-jobs-netlify-scheduled-function.md). Each run:

1. **Updates the statuses.** `refresh_membership_statuses(now)` sets each `profiles.status` from
   `expires_at`: `lapsed` from the moment it passes (there's no grace period, board decisions §4),
   `expiring` when the membership ends within 30 days, `active` otherwise. Members on yearly
   auto-renew show as expiring too, until Stripe renews them.
2. **Sends the membership emails due.** `due_membership_emails(now)` lists the first renewal
   reminder (30 days before a membership ends), the last one (7 days before), both only for members
   not on yearly auto-renew (Stripe emails those who are), and the lapsed note (14 days after). The
   job claims each email in `membership_emails`, which holds one email of each kind per member and
   membership end, then renders it, sends it and records the email service's id.
3. **Syncs the member groups in MailerLite**, with the statuses just updated, once
   `MAILERLITE_API_KEY` is set ([MailerLite member groups](#mailerlite-member-groups)).

Both functions are in `supabase/migrations/20261126143035_membership_emails.sql`, with the rules
spelled out at the top; `20261126163935_membership_status_from_row.sql` replaced the refresh with one
that works each status out from the row it updates. Days count on the Society's calendar, in Central
Time. How the job behaves:

- **Nothing goes out twice.** A second run the same day, or two runs at once, find every email
  claimed. Netlify's **Run now** button is safe.
- **A renewal during a run stands.** A member renewed while the refresh is running (by the Stripe
  webhook, once it's built) keeps the status of their new expiry date.
- **Failures are retried.** An email that fails loses its claim, so the next run sends it. Each email
  stays due for a few days after its day (the first reminder until 8 days before, the last until
  the membership ends, the lapsed note until 20 days after), so a missed run catches up, and nothing
  older is ever sent.
- **It stops in time.** Netlify allows a scheduled function 30 seconds, and the function waits 28 of
  them for the route's answer. So a run starts no email after 15 seconds (sending one can take 10
  more); the next run sends the rest.
- **The answer is a summary**, with counts and no addresses: statuses moved, emails sent of each
  kind, failed, claimed by another run, left for the next run, and the errors (with profile ids).
  The route answers 500 if anything failed, so it shows in Netlify's log; both functions log the
  summary.
- **Only server code reaches it.** `membership_emails` and both functions are for the service role:
  members and visitors can't read the claims, list who is due or call the functions.

**Turning it on in production** is a human gate (production settings, and emails to real members;
renewal emails are Launch 2, decision 0002). In Netlify's environment variables:

| Variable              | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `CRON_SECRET`         | A long random secret, such as the output of `openssl rand -hex 32` |
| `SUPABASE_SECRET_KEY` | The Supabase project's secret key (Project Settings → API Keys)    |
| `SITE_URL`            | `https://<Society domain>`                                         |
| `EMAIL_FROM`          | `noreply@mail.<Society domain>` (decision 0005)                    |
| `RESEND_API_KEY`      | A Resend API key with sending access                               |
| `MAILERLITE_API_KEY`  | Optional: turns on the MailerLite group sync (below)               |

Without `CRON_SECRET`, the function logs "The daily jobs are off" and does nothing.

**Running it locally.** In `.env.local`, set `SUPABASE_SECRET_KEY` to the local secret key
(`supabase status` prints it as `SECRET_KEY`) and `CRON_SECRET` to any value, say `local-secret`.
Restart `pnpm dev`, then send the same secret from your shell:

```bash
export CRON_SECRET=local-secret   # the value in .env.local
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

The emails land in Mailpit. This runs on the real clock across every member in the local database:
it updates the fixture members' statuses and claims their emails, so a second try sends nothing until
`supabase db reset`. On a seed more than a day old, the new statuses can fail
`supabase/tests/seed_test.sql` until that reset, so don't run it against a database others are using.

**Tests.** `supabase/tests/membership_emails_test.sql` tests the rules with a fake clock in June 2031
(each boundary, Central Time's midnight, auto-renew, claims, who can reach what).
`supabase/tests/membership_status_race_test.sql` runs a renewal and the refresh in two sessions,
through dblink in a throwaway database, and checks that the renewal keeps its status.
`lib/jobs/daily.test.ts` tests a run (claims, retries, the deadline, failures) with a fake clock and
store. `e2e/daily-jobs.spec.ts` runs the jobs against the local database and Mailpit with a clock in
June 2001, when only the members it creates are due, and checks the route refuses requests without
the secret. `lib/email/send.test.ts`, `lib/jobs/membership-store.test.ts`,
`lib/jobs/daily-jobs-function.test.ts` and `app/api/cron/daily/route.test.ts` cover the rest.

K-4 (listing expiry) adds its job to `runDailyJobs()`.

## MailerLite member groups

The site keeps seven groups in the Society's MailerLite account in step with the members' profiles
(backlog E-3, `lib/mailerlite/sync.ts`), so the newsletter writer can send a campaign to the members
who need it. Steps for volunteers:
[`docs/volunteer-guide/mailerlite-groups.md`](docs/volunteer-guide/mailerlite-groups.md).

| Group                         | Who's in it                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `Website: Active members`     | Members whose membership ends more than 30 days from now           |
| `Website: Expiring members`   | Members whose membership ends within 30 days (auto-renew ones too) |
| `Website: Lapsed members`     | Members whose membership has ended                                 |
| `Website: Individual members` | Individual members whose membership hasn't ended                   |
| `Website: Band members`       | Band members whose membership hasn't ended                         |
| `Website: Business members`   | Business members whose membership hasn't ended                     |
| `Website: Sponsor members`    | Sponsor members whose membership hasn't ended                      |

A member is in their status's group and, until their membership lapses, their level's group. A
profile with no level or status (never paid) isn't sent to MailerLite.

- **When.** Every night, as step 3 of the daily jobs, right after the statuses are updated. And
  after a change: server code that changes a membership, an address or a name (the Stripe webhook,
  recording a payment, the importer, the profile form, as they're built) calls
  `syncMembersToMailerLite([profileId])` (`lib/mailerlite/on-change.ts`) inside `after()`, once the
  change is saved.
- **Only what changed.** `mailerlite_subscribers`
  (`supabase/migrations/20261126193121_mailerlite_subscribers.sql`) records what MailerLite was last
  given for each member: the subscriber's MailerLite id, address, name and member groups. A run
  compares that with the profiles and calls MailerLite only for the members whose groups, address
  or name changed, so a quiet night costs one request (listing the groups), and running it again
  changes nothing.
- **One run per member at a time.** A run takes a member before working on them
  (`claim_mailerlite_member`, a lease of a minute) and lets go as it records what it did
  (`finish_mailerlite_member`). That statement reads the profile again, so a change made meanwhile
  is synced by the same run, which goes round again, or by whoever made it, once the member is
  free.
- **The seven groups are the site's; the rest is MailerLite's.** The sync adds and removes members
  of these groups and sets the subscriber's address and name (MailerLite's `name` and `last_name`
  fields). It never sends a status. A new subscriber gets the account's default (active, or
  unconfirmed with double opt-in), and someone who unsubscribed, bounced or marked a campaign as
  spam stays that way: MailerLite refuses an upsert for them without a resubscribe, so they're added
  to the groups one at a time. Their other groups are left alone. Someone who stops being a member
  (a refund, a deleted account) leaves the seven groups and stays in MailerLite.
- **A new address** is set on the same MailerLite subscriber, who keeps their status. If MailerLite
  refuses (another subscriber has the address, or this one's address already changed this month),
  the old subscriber leaves the groups and the member is added under the new address.
- **Missing groups are made.** Each run finds the groups by name and makes any that's missing, so a
  deleted group comes back with its members. A renamed group is no longer the site's.
- **It stops in time.** The sync shares the daily run's 15 seconds and starts no request after
  them, or once MailerLite answers 429 (it allows 120 requests a minute); the next run carries on.
  A sync after a change gets 10 seconds. Adding a member takes one request and a change of status
  two or three, so the first run with a few hundred members takes a few runs: press **Run now** on
  the daily jobs' function a few times, or let the nights do it.
- **The daily summary** says what it did under `mailerLite` (members synced, removed, left to
  another run, left for the next run, failed), or `"off"`. Its errors, with profile ids and never
  addresses, make the route answer 500.

**Off until `MAILERLITE_API_KEY` is set.** Turning it on in production is a human gate (a production
setting that sends real members' names and addresses to MailerLite). In MailerLite, open
**Integrations**, choose **MailerLite API** and select **Generate new token**, named for instance
"Website group sync - production"; set it in Netlify's environment variables as
`MAILERLITE_API_KEY`. The next daily run makes the groups and adds every member with a membership,
lapsed ones included. Adding someone to a group emails nobody; a campaign or an automation does.
Leave the key empty locally and in CI: the tests use a stand-in for MailerLite's API
(`lib/mailerlite/fake-api.ts`), and a local run would put the synthetic fixture members into a real
account.

**Tests.** `lib/mailerlite/sync.test.ts` runs the sync against the stand-in API (the groups, moves,
removals, statuses left alone, new addresses, subscribers and groups deleted in MailerLite, a member
another run has, the deadline, 429 and errors). `lib/mailerlite/client.test.ts` checks the requests
and answers, `supabase/tests/mailerlite_subscribers_test.sql` the records, the lease and who can
reach them, and `e2e/mailerlite-sync.spec.ts` runs the sync against the local database with the
stand-in API, for the members it creates only.

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
| `pnpm check:dataset`     | Check that anonymous queries can't read the Sanity dataset         |
| `pnpm email:preview`     | Preview the email templates at http://localhost:3030               |
| `pnpm format`            | Format the code with Prettier                                      |
| `pnpm format:check`      | Check formatting without writing changes                           |

## Tests

- **Unit tests** (Vitest + Testing Library, jsdom) live next to the code as `*.test.ts` or
  `*.test.tsx`. Vitest can't render `async` Server Components; cover those with end-to-end tests.
- **End-to-end tests** (Playwright) live in `e2e/`. Every test runs at desktop size and at phone
  width (390px). Locally, Playwright starts `pnpm dev`, or reuses a dev server already running on
  port 3000. With `CI=1` it serves the production build instead, so run `pnpm build` first. Set
  `E2E_PORT` to use another port.
- **Content in end-to-end tests** comes from a stand-in for Sanity, never from Sanity itself:
  `e2e/support/sanity-stand-in.mts`, a small server that answers the app's GROQ queries with groq-js
  over the documents in `e2e/fixtures/sanity-content.mts`. It acts like a private dataset (no
  token, no content). Playwright starts it on `E2E_PORT` + 400 and gives the app
  `SANITY_API_HOST_STAND_IN` (loopback addresses only, see `lib/env/schema.ts`), a made-up project ID
  and a made-up token. Next.js reads the project ID when it builds, so for `CI=1` build with the
  same values: `NEXT_PUBLIC_SANITY_PROJECT_ID=e2estandin SANITY_API_HOST_STAND_IN=http://127.0.0.1:3400 SANITY_API_READ_TOKEN=e2e-stand-in-token pnpm build`
  (CI does). A dev server you started yourself doesn't have them: stop it and let Playwright start
  one. Add documents there for your own tests, kept out of menus so the layout tests still see the
  built-in ones. For draft mode, a test opens a shared preview link (`openSharedPreviewLink()` in
  `e2e/support/sanity.ts`): the stand-in holds the link's secret, and the server sets its own
  draft-mode cookie, so this works against both `pnpm dev` and the production build. Photos and
  logos point at Sanity's image CDN, so a spec that opens a page showing them, the home page
  included (its sponsor band), stops those requests leaving the machine: `blockSanity()`, or a
  `context.route` that aborts everything but loopback.
- **Emails in end-to-end tests** go to the local stack's Mailpit, never through Resend: Playwright
  gives the app server `EMAIL_FROM`, `MAILPIT_URL` and an empty `RESEND_API_KEY`, which wins over
  `.env.local`. It also gives it the local service role key (`SUPABASE_SECRET_KEY`, or what
  `supabase status` prints), which the classifieds queue needs to email posters.

## Continuous integration

GitHub Actions runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every pull request
into `develop` or `main`, and on every push to `develop`. One job installs dependencies, starts
local Supabase, and runs `pnpm lint`, `pnpm format:check` (Prettier), `pnpm typecheck`, `pnpm test`,
`pnpm test:db` (pgTAP), `pnpm build` and `pnpm test:e2e` (against the production build). Each check
runs even when an earlier one fails, and any failure fails the run. A new push to a pull request
cancels its older run. A run of content that an earlier run already passed skips the checks (see
below). CI uses no secrets.

Local Supabase (CLI 3.4.0) starts in the background right after pnpm's setup, and the Playwright
browser install starts in the background after the install. While they run, the job runs lint, the
format check, typecheck, the unit tests and the build. A fresh stack applies the migrations and
`supabase/seed.sql`, so the database and end-to-end tests see the fixture data. CI starts only
Postgres, the API gateway, Auth, the REST API, Storage (for members-only files) and Mailpit.
Studio, Realtime, Edge Functions and the logging services stay off because no test uses them yet.
A change that needs one of them in CI drops it from the `--exclude` lists in `ci.yml`. The build
runs before the stack is up (it doesn't call Supabase), so it takes `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.example`, and the end-to-end tests first check
that `supabase status` reports the same values. They're the well-known local demo values, not
secrets. The job's first step reserves the stack's ports (54320-54329) from Linux's ephemeral
range, so no outgoing connection can hold one when Docker binds it.

To reproduce a CI run locally:

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
supabase start && pnpm test:db
NEXT_PUBLIC_SANITY_PROJECT_ID=e2estandin SANITY_API_HOST_STAND_IN=http://127.0.0.1:3400 \
  SANITY_API_READ_TOKEN=e2e-stand-in-token pnpm build
CI=1 pnpm test:e2e
```

The build takes the Supabase URL and key from `.env.local` (see
[Environment variables](#environment-variables)), and the Sanity values on its command line point
it at the end-to-end tests' stand-in for Sanity, as CI's build does. CI has no `.env.local`: the
app server gets only what the workflow and `playwright.config.ts` give it. To match that exactly,
move `.env.local` aside for the build and the tests, and export the two `NEXT_PUBLIC_SUPABASE_`
values from `.env.example` instead.

CI's database is always fresh. To match it on a stack that's already running, run
`supabase db reset` first (see [Local Supabase](#local-supabase)).

When the end-to-end tests fail, the run keeps the Playwright HTML report for 7 days as the
`playwright-report` artifact. Fetch it with
`gh run download <run-id> -n playwright-report -D playwright-report`, then open it with
`pnpm exec playwright show-report`.

CI is a single job because the repository is private on GitHub's free plan: 2,000 Actions minutes
a month, with each job billed rounded up to the minute. A team that pushes around the clock uses
that up in days, and paying for more minutes is a human decision (`docs/HUMAN_GATES.md`, "Money and
accounts"). So CI keeps runs short:

- Starting local Supabase takes about two minutes, mostly pulling its Docker images, so everything
  up to the database tests runs while it starts.
- The build restores the latest `develop` run's Next.js build cache (`.next/cache`, where Turbopack
  keeps its build cache since Next.js 16.3). Only pushes to `develop` save it.
- The unit tests run two workers, one per CPU of the runner. The end-to-end tests stay on one: with
  two, the Sanity Studio test sometimes never drew its screen, even given 15 s.
- A run that passes every check records the tree it tested as a `passed-tree-<tree>` artifact,
  kept 7 days. A later run of the same tree skips the checks and succeeds, with a notice that links
  the run that passed. That's usually the push to `develop` when a pull request merges into a
  `develop` that hasn't moved since the pull request's last run. A run of a new tree runs every
  check.

## Hosting (Netlify)

Netlify builds the site as [`netlify.toml`](netlify.toml) says: `pnpm run build`, then Netlify's
Next.js adapter (OpenNext, `@netlify/plugin-nextjs`) turns the build into a server function and
`proxy.ts` into an edge function, and connects the Next.js cache to Netlify's CDN. Netlify adds the
adapter by itself only to a site created by linking a repository in its dashboard, so
`netlify.toml` names it. It isn't in `package.json`: Netlify then installs the latest version on
every build, as its docs recommend. Without the adapter, Netlify publishes the raw `.next` folder,
every page is a 404, and the build's manifest files are public.

- Every push to `develop` deploys to https://develop--obs-platform.netlify.app (a branch deploy).
  `main` is production. Pull requests get no deploy preview.
- A working deploy answers 200 for `/design-preview` and 404 for `/routes-manifest.json`.
- To try a Netlify build without an account, use the Netlify CLI (not a project dependency):
  `NETLIFY_TELEMETRY_DISABLED=1 npx netlify-cli build --offline`. `netlify serve` then serves it
  locally, without Netlify's CDN.

## Project layout

```
.github/        CI workflow (GitHub Actions)
app/            Next.js App Router: pages, layouts, route handlers
components/     Shared UI: components/ui/ (buttons, cards, form fields, modal…), the layout shell (components/layout/), home page sections (components/home/), page blocks (components/blocks/), page templates (components/templates/) and form classes
lib/            Server and shared code: Supabase clients, sign-in helpers, sending email, the daily jobs, the MailerLite sync
netlify/        Netlify Functions: the daily jobs' schedule (netlify/functions/)
netlify.toml    How Netlify builds the site (see Hosting (Netlify))
proxy.ts        Runs before every request: refreshes Supabase sessions
e2e/            Playwright end-to-end tests
emails/         Email templates (React Email)
scripts/        Synthetic fixtures (scripts/fixtures/) and the seed generator
sanity/         Sanity client, live preview helpers, Studio structure and content schemas
supabase/       Local Supabase config, migrations, seed and pgTAP tests
docs/           Specs, decisions, design concept, backlog
tools/          Helper scripts for the agent team
```

Later backlog items add the rest of the target layout in
[`docs/spec/architecture.md`](docs/spec/architecture.md): the rest of `scripts/`.

## Components

The shared components (backlog D-3) are in `components/ui/`: buttons, cards, tags, pill filters, a
data table, form fields, a modal, toasts, the members-only lock overlay, and event, post and sponsor
cards. With `pnpm dev` running, <http://localhost:3000/dev/components> shows them all with
placeholder content (development only: a production build answers 404 there).
[`docs/design/components.md`](docs/design/components.md) says what each one is for and the rules
they follow, such as never passing members-only content to a component that blurs it.

## Design Approval package

`/design-preview` holds the home page and the four page templates with sample content (backlog
D-4), for the Society's Design Approval. Unlike `/dev/components`, it's in production builds, so
the preview deploy serves it; search engines are asked to skip it. The home page's sections, the
page blocks and the templates live in `components/home/`, `components/blocks/` and
`components/templates/`, where P-1 and C-2 fill them from the Studio.
[`docs/design/approval-package.md`](docs/design/approval-package.md) lists the pages, the open
questions and how a revision round works. Delete the folder before launch.

## Design tokens

Colors, fonts, type sizes, spacing and radii come from the approved concept
(`docs/design/prototype.html`) and live in `app/globals.css` as Tailwind theme tokens. Use their
classes (`bg-canvas`, `text-muted`, `rounded-card`), never hex values or Tailwind's own palette; a
unit test fails on hard-coded colors. [`docs/design/tokens.md`](docs/design/tokens.md) lists the
tokens, the WCAG contrast of each color pair, and how to swap in the Society's real brand.

## Site layout

Every page in the `app/(site)/` route group (the public pages, sign-in and My Account) gets its
header, `<main>` and footer from `app/(site)/layout.tsx` (backlog D-2). The Studio has none.

- **Pages** render their content without a `<main>` of their own: the layout's carries the id the
  "Skip to main content" link targets. Most start with `<PageHeader title="…" intro="…" />`
  (`components/layout/page-header.tsx`), the blue band that holds the page's one `<h1>`.
- **Menus** (`lib/site/navigation.ts`): Events, Blog, Sponsors and Donate are always in the header,
  plus the pages and links editors put in a menu (a page's Show in menu; Other menu links in Site
  settings), which `sanity/site-chrome.ts` loads in a `"use cache"` function. With no Sanity
  project, or if Sanity fails, the built-in links still show. Below the `lg` breakpoint (1024px) a
  Menu button opens the menu; Escape closes it and puts focus back on the button.
- **Account links**: Sign in and Join, or My Account, from `getCurrentUser()` inside `<Suspense>`,
  so the rest of the header is prerendered. Without Supabase settings, everyone is a visitor.
- **The footer** shows Site settings' footer fields and the editors' footer links.
- **Links ahead of their pages:** the header and footer link to `/events`, `/sponsors`, `/donate`
  and `/join` (Membership Benefits & Join), which 404 until P-2, P-4, P-6 and M-4 build them.
  Classifieds joins the menu with K-* (Launch 2).

## Next.js 16 notes

- This project uses Next.js 16 with **Cache Components** and **Partial Prefetching** enabled
  (`next.config.ts`), and Turbopack for dev and build. Some APIs differ from older versions: read
  the docs bundled in `node_modules/next/dist/docs/` before relying on memory (see `AGENTS.md`).
- `next-env.d.ts` and the route types in `.next/` are generated by `next dev`, `next build` and
  `next typegen`. They're git-ignored; `pnpm typecheck` regenerates them first.
