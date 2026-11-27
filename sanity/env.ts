// Where the Content Studio and the site find Sanity: NEXT_PUBLIC_SANITY_PROJECT_ID and
// NEXT_PUBLIC_SANITY_DATASET, checked by lib/env. Safe to import anywhere: the project ID and
// dataset name aren't secrets (every API request carries them), so they're public variables, which
// the Studio needs in the browser. The read token is server-only (see sanity/live.ts).
//
// The Society's Sanity project doesn't exist yet: creating it is a human gate (decision 0002, due
// Dec 3). Until NEXT_PUBLIC_SANITY_PROJECT_ID is set, lib/env gives the placeholder project ID
// "placeholder", which keeps the build and /studio working, but nothing can sign in to the Studio
// or read content. The dataset is development unless NEXT_PUBLIC_SANITY_DATASET says otherwise.
//
// Imports name their files in full (".ts"): scripts/sanity/check-private-dataset.mts loads this
// file in plain Node.
import { publicEnv } from "../lib/env/public.ts";
import { PLACEHOLDER_SANITY_PROJECT_ID } from "../lib/env/schema.ts";

export const PLACEHOLDER_PROJECT_ID = PLACEHOLDER_SANITY_PROJECT_ID;

const env = publicEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET");

export const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
export const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
/** False while the project ID is the placeholder. */
export const isConfigured = projectId !== PLACEHOLDER_PROJECT_ID;

/** The Sanity API version (a date) this app was written against. */
export const apiVersion = "2026-11-26";

/** Where the Studio is mounted in the app (app/studio/[[...tool]]). */
export const studioBasePath = "/studio";
