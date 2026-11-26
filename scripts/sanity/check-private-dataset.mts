/**
 * `pnpm check:dataset`: checks that the Sanity dataset in the environment (.env.local, or
 * the shell's variables) is private, so members-only content can't be read without the token.
 * Exit codes: 0 private, 1 anyone can read it (act now), 2 the check couldn't tell.
 * See ./private-dataset.mts.
 */
import { apiVersion, readSanityEnv } from "../../sanity/env.ts";
import { checkPrivateDataset, EXIT_CODES } from "./private-dataset.mts";

const { projectId, dataset, isConfigured } = readSanityEnv({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
});

if (!isConfigured) {
  console.error("No Sanity project to check: set NEXT_PUBLIC_SANITY_PROJECT_ID (see the README).");
  process.exit(EXIT_CODES.unknown);
}

const result = await checkPrivateDataset({
  projectId,
  dataset,
  apiVersion,
  token: process.env.SANITY_API_READ_TOKEN?.trim() || undefined,
});
(result.status === "private" ? console.log : console.error)(result.message);
process.exit(EXIT_CODES[result.status]);
