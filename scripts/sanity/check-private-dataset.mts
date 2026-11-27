/**
 * `pnpm check:dataset`: checks that the Sanity dataset in the environment (.env.local, or
 * the shell's variables) is private, so members-only content can't be read without the token.
 * Exit codes: 0 private, 1 anyone can read it (act now), 2 the check couldn't tell.
 * See ./private-dataset.mts.
 */
import { EnvError, parseServerEnv } from "../../lib/env/schema.ts";
import { checkPrivateDataset, EXIT_CODES } from "./private-dataset.mts";

// sanity/env.ts checks the Sanity variables as it loads. A bad one means the check couldn't tell
// (exit 2), not that the dataset is public (exit 1).
let sanity: typeof import("../../sanity/env.ts");
let token: string | undefined;
try {
  sanity = await import("../../sanity/env.ts");
  token = parseServerEnv(process.env, ["SANITY_API_READ_TOKEN"]).SANITY_API_READ_TOKEN;
} catch (error) {
  if (!(error instanceof EnvError)) throw error;
  console.error(error.message);
  process.exit(EXIT_CODES.unknown);
}

if (!sanity.isConfigured) {
  console.error("No Sanity project to check: set NEXT_PUBLIC_SANITY_PROJECT_ID (see the README).");
  process.exit(EXIT_CODES.unknown);
}

const result = await checkPrivateDataset({
  projectId: sanity.projectId,
  dataset: sanity.dataset,
  apiVersion: sanity.apiVersion,
  token,
});
(result.status === "private" ? console.log : console.error)(result.message);
process.exit(EXIT_CODES[result.status]);
