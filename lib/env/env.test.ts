// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicEnv } from "./public";
import { PUBLIC_VARS } from "./schema";
import { serverEnv } from "./server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicEnv", () => {
  it("reads every public variable by its full name, which is what Next.js builds in", () => {
    const values: Record<string, string> = {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123xy",
      NEXT_PUBLIC_SANITY_DATASET: "staging",
    };
    expect(Object.keys(values).sort()).toEqual(Object.keys(PUBLIC_VARS).sort());
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);

    expect(publicEnv()).toEqual(values);
  });

  it("checks only the variables it's asked for", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_SANITY_DATASET", "staging");

    expect(publicEnv("NEXT_PUBLIC_SANITY_DATASET")).toEqual({
      NEXT_PUBLIC_SANITY_DATASET: "staging",
    });
    expect(() => publicEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL must be");
  });
});

describe("serverEnv", () => {
  it("reads the server-only variables from the environment, checked", () => {
    vi.stubEnv("CRON_SECRET", " local-secret ");
    vi.stubEnv("SITE_URL", "ozarkblues.example");

    expect(serverEnv("CRON_SECRET")).toEqual({ CRON_SECRET: "local-secret" });
    expect(() => serverEnv("CRON_SECRET", "SITE_URL")).toThrow("SITE_URL must be");
  });
});
