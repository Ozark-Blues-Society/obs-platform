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
  return enableDraftMode(request);
}
