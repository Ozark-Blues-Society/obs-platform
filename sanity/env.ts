// Where the Content Studio and the site find Sanity. Safe to import anywhere: the project ID and
// dataset name aren't secrets (every API request carries them), so they use NEXT_PUBLIC_ variables,
// which the Studio needs in the browser. The read token is server-only (see sanity/live.ts).
//
// The Society's Sanity project doesn't exist yet: creating it is a human gate (decision 0002, due
// Dec 3). Until NEXT_PUBLIC_SANITY_PROJECT_ID is set, a placeholder project ID keeps the build and
// /studio working, but nothing can sign in to the Studio or read content.

export const PLACEHOLDER_PROJECT_ID = "placeholder";

export type SanityEnv = {
  projectId: string;
  dataset: string;
  /** False while the project ID is the placeholder. */
  isConfigured: boolean;
};

/** Reads the Sanity project ID and dataset from the given variables, with placeholders. */
export function readSanityEnv(vars: {
  projectId: string | undefined;
  dataset: string | undefined;
}): SanityEnv {
  const projectId = vars.projectId?.trim() || PLACEHOLDER_PROJECT_ID;
  const dataset = vars.dataset?.trim() || "development";
  return { projectId, dataset, isConfigured: projectId !== PLACEHOLDER_PROJECT_ID };
}

// Next.js inlines NEXT_PUBLIC_ variables into browser code only when they're written out in full.
export const { projectId, dataset, isConfigured } = readSanityEnv({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
});

/** The Sanity API version (a date) this app was written against. */
export const apiVersion = "2026-11-26";

/** Where the Studio is mounted in the app (app/studio/[[...tool]]). */
export const studioBasePath = "/studio";
