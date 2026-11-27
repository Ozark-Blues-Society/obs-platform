import { afterEach, describe, expect, it, vi } from "vitest";

/** sanity/env.ts as it loads with these variables set. */
async function loadWith(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sanity/env", () => {
  it("uses the project ID and dataset it's given", async () => {
    const env = await loadWith({
      NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123xy",
      NEXT_PUBLIC_SANITY_DATASET: "staging",
    });
    expect(env).toMatchObject({ projectId: "abc123xy", dataset: "staging", isConfigured: true });
  });

  it("falls back to placeholders until the Sanity project exists", async () => {
    const env = await loadWith({
      NEXT_PUBLIC_SANITY_PROJECT_ID: undefined,
      NEXT_PUBLIC_SANITY_DATASET: " ",
    });
    expect(env).toMatchObject({
      projectId: env.PLACEHOLDER_PROJECT_ID,
      dataset: "development",
      isConfigured: false,
    });
  });

  it("refuses a project ID that Sanity wouldn't take, naming the variable", async () => {
    await expect(loadWith({ NEXT_PUBLIC_SANITY_PROJECT_ID: "not a project" })).rejects.toThrow(
      "NEXT_PUBLIC_SANITY_PROJECT_ID must be a Sanity project ID",
    );
  });
});
