import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { connection } from "next/server";
import { client, hasReadToken } from "@/sanity/live";

// The Presentation tool and shared preview links open this route. It turns on draft mode only for
// a secret that Sanity confirms (one the Studio created), then redirects to the page to preview.
// Anything else gets a 401.
const { GET: enableDraftMode } = defineEnableDraftMode({ client });

export async function GET(request: Request) {
  // Answer every request fresh. Without this, Cache Components would prerender the 503 below at
  // build time whenever the token is missing then.
  await connection();
  if (!hasReadToken) {
    // Checking the secret needs the read token; without it the library would throw.
    console.error("Draft mode can't be turned on: SANITY_API_READ_TOKEN isn't set.");
    return new Response("Previews aren't available.", { status: 503 });
  }
  // Before the secret is checked, so a refused link never sets a draft-mode cookie.
  if (!redirectsToThisSite(request.url)) {
    return new Response("Previews only open pages on this site.", { status: 400 });
  }
  return enableDraftMode(request);
}

// Once the secret checks out, the library redirects to the path, query and hash of
// new URL(sanity-preview-pathname, "http://localhost"), and Next.js puts that in the Location
// header unchanged. Anyone with a valid secret can choose the value (a shared preview link carries
// one that never expires), so allow only a path that starts with exactly one "/". Anything else
// can leave the site: browsers read "//evil.example/" and "/\evil.example" as another host, and
// under an unknown scheme the "path" can be a whole URL ("x:https://evil.example/").
function redirectsToThisSite(requestUrl: string): boolean {
  const base = "http://localhost";
  const pathname = new URL(requestUrl, base).searchParams.get("sanity-preview-pathname");
  if (!pathname) {
    // The library then redirects to "/".
    return true;
  }
  const target = URL.parse(pathname, base);
  return target !== null && /^\/(?![/\\])/.test(target.pathname);
}
