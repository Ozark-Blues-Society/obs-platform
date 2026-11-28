# 0008 — Cache Components and Partial Prefetching stay on, on Netlify

Status: Accepted (technical choice, F-1 review follow-up op-73f.3, 2026-11-27). It keeps two
Next.js settings as they are and adds no account or cost, so it isn't a human gate
(`docs/HUMAN_GATES.md`).

## Context

`next.config.ts` has had `cacheComponents: true` and `partialPrefetching: true` since F-1 (the
create-next-app 16.4.6 defaults). Partial Prefetching needs Cache Components. The Next.js docs say
both will be on everywhere in the next major release, and the options will be removed.

The site is hosted on Netlify (fixed stack). In March 2026
[Netlify wrote](https://www.netlify.com/blog/the-next-js-adapter-api-just-shipped-here-s-what-comes-next)
that Partial Prerendering needs CDN support "no CDN other than Vercel's has", and that its adapter
for Next.js's new Adapter API would ship later in the year. Nobody had checked how a Cache
Components app behaves on Netlify. Turning the flags off gets dearer as code adopts them:
`"use cache"`, `cacheLife` and Sanity Live's cache tags are in `sanity/`, and request reads sit
inside `<Suspense>` boundaries.

## Decision

Keep both flags on. `next.config.ts` doesn't change.

## What was checked (2026-11-27)

**Netlify's docs**
([Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)):
Cache Components, Draft Mode, Turbopack, streaming, Server Actions and on-demand revalidation are
all "Full Support". Netlify runs Next.js through its open-source OpenNext adapter,
`@netlify/plugin-nextjs` (5.16.9, 2026-11-23). The adapter makes one server function for pages,
Partial Prerendering, Route Handlers and Server Actions, and an edge function for `proxy.ts`. It
keeps the Next.js caches on Netlify, revalidated by path or tag. Its maintainers say Partial
Prerendering and Cache Components are supported
([opennextjs-netlify#3474](https://github.com/opennextjs/opennextjs-netlify/issues/3474)) and test
every Next.js release. Their end-to-end suite runs Next.js 16's `revalidateTag(tag, profile)` and
`updateTag` against real Netlify deploys. The Adapter API version is still in progress upstream.

What Netlify's March post means in practice: no CDN serves a page's static shell by itself. A page
with a streamed part (◐ in `next build`'s route list) is answered by the server function on every
request, shell first and the streamed parts after, in one response. Fully static pages (○) and
cached responses come from Netlify's CDN. That costs some speed on ◐ pages; no feature is missing.

**Why the first deploy showed 404s**: Netlify adds its adapter by itself only to a site created by
linking a repository in its dashboard. PR #64 names it in `netlify.toml`, unpinned (README,
"Hosting (Netlify)").

**A local Netlify build** (Netlify CLI 27.20.1, no account) of `develop` with `netlify.toml`, served
with `netlify serve` and throwaway probe pages:

| Check | Result |
| --- | --- |
| Static pages serve | `/design-preview` and its templates: 200. A fully static page gets `Netlify-CDN-Cache-Control: s-maxage=31536000, durable`; one that revalidates every 15 minutes gets `s-maxage=900, stale-while-revalidate=…`. |
| `cookies()` inside `<Suspense>` renders per request | Requests with different cookies got different output. ◐ pages answer `private, no-store`, so the CDN never stores one visitor's page. `/sign-in?error=link-expired` shows its alert and `/sign-in` doesn't. |
| `"use cache"` and `revalidateTag` across requests | The cached value repeats across requests, with its tag on the response (`Netlify-Cache-Tag`). After `revalidateTag(tag, { expire: 0 })` the next request rendered it again, on a static page and on a ◐ page. After `revalidateTag(tag, "max")`, which Sanity Live calls, the page stays stale until Netlify's CDN sends its background revalidation request. There is no CDN locally; sending that request by hand re-rendered both pages. |
| Draft mode | Enabling it sets the bypass cookie. With the cookie, cached functions run on every request and the response is `private, no-store`; without it, visitors get the cached page. Netlify's CDN varies cached pages on that cookie. |
| Partial Prefetching | The browser prefetched each linked route's App Shell (`next-router-segment-prefetch` requests, all 200), and a click navigated without a page load. |

PR #64's reviewer also ran the session code, which the probes above skipped because they had no
Supabase settings. With local Supabase settings, `proxy.ts` ran as an edge function and sent a
visitor who opened `/account` to sign in. A password sign-in as a fixture member reached
`/account`, a reload kept the session, and `/account` answered `private, no-store` to the browser
and the CDN.

**The real deploy** (the develop branch deploy at `f7ab408`, after PR #64, 2026-11-27 19:40Z):

- Every page checked answers 200: `/`, `/design-preview` and its templates, `/sign-in`, `/studio`,
  `/events` and `/account`. The raw build files are gone: `/server/app/index.html` is a 404, and
  `/routes-manifest.json` gets the site's own not-found page (the `[slug]` route answers unknown
  one-part addresses with status 200 and `noindex`).
- `/design-preview` comes from Netlify's CDN (`Cache-Status: "Netlify Durable"; hit`), with its
  15-minute `s-maxage` and its cache tags. Pages with a streamed part (`/`, `/sign-in`) bypass the
  CDN (`private, no-store`, `x-nextjs-postponed: 1`), and `/sign-in?error=link-expired` shows the
  alert that `/sign-in` doesn't.
- `proxy.ts` runs as an edge function on every page (the `debug-x-nf-edge-functions` header, shown
  with the request header `x-nf-debug-logging: 1`).
- In Chromium, `/design-preview` made 22 App Shell prefetch requests (all 200,
  `text/x-component`), and a click to a template navigated without a page load or another request.
- Not checked on Netlify yet, because the deploys have no Sanity settings: Sanity Live's
  revalidation and draft mode (see Consequences).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A. Keep both flags on. **Chosen.** | Netlify supports them, and the checks above pass. No code changes. Next.js's next major turns both on anyway. | ◐ pages always run the server function: no edge-served shell. The adapter still gets fixes for this model, which an unpinned adapter picks up. |
| B. Turn both off | The previous caching model, which Netlify has served longer. | Rewrites every `"use cache"`, `cacheLife` and Sanity Live use and the `<Suspense>` patterns, only to bring them back at the next major. Gains no feature on Netlify. |

## Consequences

- Later items keep to the Cache Components patterns in the README: request data (`cookies()`,
  `headers()`, `searchParams`, `connection()`) inside `<Suspense>`, and Sanity reads through
  `sanityFetch` inside `"use cache"` functions.
- With Cache Components on, the route segment configs `dynamic`, `dynamicParams`, `revalidate` and
  `fetchCache` don't exist, and `runtime` must go, even `runtime = 'nodejs'` (Route Handlers run on
  Node.js anyway). Recipes from other docs that export them need adapting: `"use cache"` with
  `cacheLife` instead of `revalidate` or `dynamic = 'force-static'` (a page that reads no data,
  like the Studio's, needs nothing), and nothing instead of `runtime`.
- Logging needs no special care. Netlify's functions run on AWS Lambda, which stamps each console
  line with the time, and Cache Components fails a prerender that reads the clock. But Lambda
  patches the console before Next.js loads, and Next.js 16 runs console methods patched that early
  outside its clock check ([vercel/next.js#83843](https://github.com/vercel/next.js/pull/83843)).
  So [opennextjs-netlify#3117](https://github.com/opennextjs/opennextjs-netlify/issues/3117), still
  open, no longer applies: a local probe with a Lambda-style console patch confirmed it (PR #65's
  review). Reading the time yourself (`new Date()`, `Date.now()`) in the static part of a render
  still fails it (the Next.js caching docs, "Random values and timestamps").
- Sanity Live's revalidation and draft mode haven't run on Netlify yet: the deploys have no Sanity
  settings. When a deploy first gets them, publish a change and reload the page twice: the first
  load may show the old version, the second must show the new one. Then open a draft in the
  Studio's Presentation tool and check the page shows it. The launch runbook (op-rla) has the
  step.
- Once Supabase is configured, the header's account links read the session on every page, so every
  page has a streamed part and every page view runs the server function (Netlify bills function
  time). The flags don't cause this: without them, those pages would be fully dynamic.
- The adapter stays unpinned (`netlify.toml`), so Netlify's fixes for new Next.js versions arrive
  without a change here.
- If the site moves to Vercel (the fallback host), both flags work there as they are, with
  edge-served shells.
