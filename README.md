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
  `set_config('role', ...)`): the test can't see every form of that, so reviewers check by hand.

### Fixtures and seed data

Synthetic data lives in `scripts/fixtures/`. Real member data never goes in the repo.

- `members.mts`: 40 members across the four levels and three statuses (active, expiring,
  lapsed), including the staff roles below.
- `listings.mts`: classifieds in every category and status.
- `events.mts`: events and venues. Events live in Sanity, so these go to Sanity's development
  dataset once the schemas exist (C-1).

`supabase/seed.sql` is generated from the fixtures by `pnpm fixtures:generate`, and `pnpm test`
fails if it's out of date. The seed loads only tables that exist. Today that's the members'
sign-ins, their profiles and the staff roles; listings (K-1) join it with their migration.

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
  told to sign out and in again before they can change their password.
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
- **Pages that show Sanity content** go under `app/(site)/`, the route group that holds the
  draft-mode tools; the Studio stays outside it. They read pages, posts and events through
  `sanity/content` (see [Members-only content](#members-only-content)). Inside `sanity/`, call
  `sanityFetch` inside a `"use cache"` function and resolve `getDynamicFetchOptions()` outside it,
  as in Sanity's guide
  [Sanity Live with Next.js Cache Components](https://www.sanity.io/docs/nextjs/cache-components).

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
  and photo (not the venue), and a locked page its title. Everything else goes in `content`.
- `listGatedItems(type, content, { filter, params, order, limit })` does the same for lists, feeds
  and sitemaps.
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

**Checking the dataset is private.** `pnpm check:dataset` asks Sanity, without a token, for
anything in the dataset named in `.env.local`, and fails (exit 1) if it gets any of it back. Sanity
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

Stripe also emails its own receipt for online payments (decision 0002), and its own notices to
members on yearly auto-renew, who get no renewal reminders. Each email is about the recipient's own
membership, payment or listing and promotes nothing, so none has an unsubscribe link. The lapsed
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
  reminders and the lapsed note) and `emails/listing.test.ts` render each template.
  `emails/templates.test.ts` checks every template it finds (one title, the language, absolute
  links, token colors only, a plain-text version with no gaps), so it covers a new template
  without changes. `e2e/emails.spec.ts` loads each email in the browser at desktop and 390px
  width.

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

Both functions are in `supabase/migrations/20261126143035_membership_emails.sql`, with the rules
spelled out at the top. Days count on the Society's calendar, in Central Time. How the job behaves:

- **Nothing goes out twice.** A second run the same day, or two runs at once, find every email
  claimed. Netlify's **Run now** button is safe.
- **Failures are retried.** An email that fails loses its claim, so the next run sends it. Each email
  stays due for a few days after its day (the first reminder until 8 days before, the last until
  the membership ends, the lapsed note until 20 days after), so a missed run catches up, and nothing
  older is ever sent.
- **It stops in time.** Netlify allows a scheduled function 30 seconds, so a run starts no email
  after 20 seconds; the next run sends the rest.
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

Without `CRON_SECRET`, the function logs "The daily jobs are off" and does nothing.

**Running it locally.** Put any `CRON_SECRET` and the local `SUPABASE_SECRET_KEY` (`supabase status`
prints it as `SECRET_KEY`) in `.env.local`, restart `pnpm dev`, then:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

The emails land in Mailpit. This runs on the real clock across every member in the local database:
it updates the fixture members' statuses and claims their emails, so a second try sends nothing until
`supabase db reset`. On a seed more than a day old, the new statuses can fail
`supabase/tests/seed_test.sql` until that reset, so don't run it against a database others are using.

**Tests.** `supabase/tests/membership_emails_test.sql` tests the rules with a fake clock in June 2031
(each boundary, Central Time's midnight, auto-renew, claims, who can reach what).
`lib/jobs/daily.test.ts` tests a run (claims, retries, the deadline, failures) with a fake clock and
store. `e2e/daily-jobs.spec.ts` runs the jobs against the local database and Mailpit with a clock in
June 2001, when only the members it creates are due, and checks the route refuses requests without
the secret. `lib/email/send.test.ts`, `lib/jobs/membership-store.test.ts`,
`lib/jobs/daily-jobs-function.test.ts` and `app/api/cron/daily/route.test.ts` cover the rest.

K-4 (listing expiry) and E-3 (the nightly MailerLite sync) add their jobs to `runDailyJobs()`.

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
  `SANITY_API_HOST_STAND_IN` (loopback addresses only, see `sanity/live.ts`), a made-up project ID
  and a made-up token. Next.js reads the project ID when it builds, so for `CI=1` build with the
  same values: `NEXT_PUBLIC_SANITY_PROJECT_ID=e2estandin SANITY_API_HOST_STAND_IN=http://127.0.0.1:3400 SANITY_API_READ_TOKEN=e2e-stand-in-token pnpm build`
  (CI does). A dev server you started yourself doesn't have them: stop it and let Playwright start
  one. Add documents there for your own tests, kept out of menus so the layout tests still see the
  built-in ones. For draft mode, a test opens a shared preview link (`openSharedPreviewLink()` in
  `e2e/support/sanity.ts`): the stand-in holds the link's secret, and the server sets its own
  draft-mode cookie, so this works against both `pnpm dev` and the production build.

## Continuous integration

GitHub Actions runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every pull request
into `develop` or `main`, and on every push to `develop`. One job installs dependencies, starts
local Supabase, and runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db` (pgTAP),
`pnpm build` and `pnpm test:e2e` (against the production build). Each check runs even when an
earlier one fails, and any failure fails the run. A new push to a pull request cancels its older
run. A run of content that an earlier run already passed skips the checks (see below). CI uses no
secrets.

Local Supabase (CLI 3.4.0) starts in the background right after pnpm's setup, and the Playwright
browser install starts in the background after the install. While they run, the job runs lint,
typecheck, the unit tests and the build. A fresh stack applies the migrations and
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

## Project layout

```
.github/        CI workflow (GitHub Actions)
app/            Next.js App Router: pages, layouts, route handlers
components/     Shared UI: components/ui/ (buttons, cards, form fields, modal…), the layout shell (components/layout/), home page sections (components/home/), page blocks (components/blocks/), page templates (components/templates/) and form classes
lib/            Server and shared code: Supabase clients, sign-in helpers, sending email, the daily jobs
netlify/        Netlify Functions: the daily jobs' schedule (netlify/functions/)
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
- **Links ahead of their pages:** the header and footer link to `/events`, `/blog`, `/sponsors`,
  `/donate` and `/join` (Membership Benefits & Join), which 404 until P-2, P-3, P-4, P-6 and M-4
  build them. Classifieds joins the menu with K-* (Launch 2).

## Next.js 16 notes

- This project uses Next.js 16 with **Cache Components** and **Partial Prefetching** enabled
  (`next.config.ts`), and Turbopack for dev and build. Some APIs differ from older versions: read
  the docs bundled in `node_modules/next/dist/docs/` before relying on memory (see `AGENTS.md`).
- `next-env.d.ts` and the route types in `.next/` are generated by `next dev`, `next build` and
  `next typegen`. They're git-ignored; `pnpm typecheck` regenerates them first.
