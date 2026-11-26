import { describe, expect, it } from "vitest";
import { PLACEHOLDER_PROJECT_ID, readSanityEnv } from "./env";

describe("readSanityEnv", () => {
  it("uses the project ID and dataset it's given", () => {
    expect(readSanityEnv({ projectId: "abc123xy", dataset: "staging" })).toEqual({
      projectId: "abc123xy",
      dataset: "staging",
      isConfigured: true,
    });
  });

  it("falls back to placeholders until the Sanity project exists", () => {
    expect(readSanityEnv({ projectId: undefined, dataset: undefined })).toEqual({
      projectId: PLACEHOLDER_PROJECT_ID,
      dataset: "development",
      isConfigured: false,
    });
  });

  it("treats blank values as unset", () => {
    expect(readSanityEnv({ projectId: "  ", dataset: "" })).toEqual({
      projectId: PLACEHOLDER_PROJECT_ID,
      dataset: "development",
      isConfigured: false,
    });
  });

  it("trims stray whitespace from pasted values", () => {
    expect(readSanityEnv({ projectId: " abc123xy\n", dataset: " development " })).toMatchObject({
      projectId: "abc123xy",
      dataset: "development",
    });
  });
});
