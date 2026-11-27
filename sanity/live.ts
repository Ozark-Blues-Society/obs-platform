// Server-side Sanity access: the client that reads content, and Sanity Live for cached pages and
// previews. It imports next/headers, so Next.js refuses to bundle it into browser code.
import { cookies, draftMode } from "next/headers";
import { createClient } from "next-sanity";
import { defineLive, resolvePerspectiveFromCookies, type LivePerspective } from "next-sanity/live";
import { serverEnv } from "@/lib/env/server";
import { apiVersion, dataset, projectId, studioBasePath } from "./env";

const env = serverEnv("SANITY_API_READ_TOKEN", "SANITY_API_HOST_STAND_IN");

// A Viewer token for the dataset. Decision 0001 makes the datasets private, so every read needs
// it, published content included. A server-only variable: Next.js never sends it to the browser.
const readToken = env.SANITY_API_READ_TOKEN;

export const hasReadToken = readToken !== undefined;

// End-to-end tests only: the address of a local stand-in for Sanity's API
// (e2e/support/sanity-stand-in.mts), so pages can show content in CI without a Sanity project.
// lib/env accepts only a loopback address, so a mistake can't send the read token anywhere else.
// SANITY_API_HOST_STAND_IN stays unset everywhere else.
const standInHost = env.SANITY_API_HOST_STAND_IN;

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  ...(standInHost ? { apiHost: standInHost, useProjectHostname: false } : {}),
  perspective: "published",
  token: readToken,
  // In draft mode, text carries invisible markers so editors can click it to edit it.
  stega: { studioUrl: studioBasePath },
});

export const { sanityFetch, SanityLive } = defineLive({
  client,
  serverToken: readToken ?? false,
  // Never send a token to the browser: anyone holding a shared preview link would get read access
  // to the whole private dataset, members-only content included (decision 0001). <SanityLive>
  // follows published changes without one, and the Presentation tool refreshes the preview on
  // every draft edit (app/(site)/draft-mode/visual-editing.tsx).
  browserToken: false,
  strict: true,
});

export type DynamicFetchOptions = { perspective: LivePerspective; stega: boolean };

/**
 * What this request should see: published content, or drafts while draft mode is on (live preview
 * in the Studio, or a shared preview link). Call it outside "use cache" and pass the result into
 * the cached component that calls sanityFetch.
 */
export async function getDynamicFetchOptions(): Promise<DynamicFetchOptions> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) {
    return { perspective: "published", stega: false };
  }
  const perspective = await resolvePerspectiveFromCookies({ cookies: await cookies() });
  return { perspective: perspective ?? "drafts", stega: true };
}
