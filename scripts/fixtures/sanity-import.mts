/**
 * `pnpm fixtures:sanity`: writes the synthetic Sanity fixtures to the development dataset of the
 * Sanity project in the environment (.env.local, or the shell's variables). It needs a token with
 * the Editor role in SANITY_API_WRITE_TOKEN, which nothing else reads: add it for the run and take
 * it out afterwards (see the README). Exit code 0 when the fixtures were written, 1 otherwise.
 * See ./sanity-fixtures.mts.
 */
import { EnvError } from "../../lib/env/schema.ts";
import { importSanityFixtures } from "./sanity-fixtures.mts";

// sanity/env.ts checks the Sanity variables as it loads.
let sanity: typeof import("../../sanity/env.ts");
try {
  sanity = await import("../../sanity/env.ts");
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  console.error(error.message);
  process.exit(1);
}

if (!sanity.isConfigured) {
  console.error("No Sanity project to load: set NEXT_PUBLIC_SANITY_PROJECT_ID (see the README).");
  process.exit(1);
}

const result = await importSanityFixtures({
  projectId: sanity.projectId,
  dataset: sanity.dataset,
  apiVersion: sanity.apiVersion,
  token: process.env.SANITY_API_WRITE_TOKEN?.trim() || undefined,
});
(result.ok ? console.log : console.error)(result.message);
process.exit(result.ok ? 0 : 1);
