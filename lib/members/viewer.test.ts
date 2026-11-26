// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const BAND_ID = "00000000-0000-4000-8100-000000000018";

// A stand-in for Supabase: the session (getClaims) and the caller's profile row.
const db = vi.hoisted(() => ({
  configured: true,
  signedIn: true,
  profile: null as object | null,
  error: null as { code: string; message: string } | null,
  filters: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase/config", () => ({
  readSupabaseConfig: () => (db.configured ? { url: "http://x", publishableKey: "k" } : null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: BAND_ID, email: "tasha.moore@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => {
      expect(table).toBe("profiles");
      const builder = {
        select: (columns: string) => {
          expect(columns).toBe("level, expires_at");
          return builder;
        },
        eq: (column: string, value: unknown) => {
          db.filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: db.profile, error: db.error }),
      };
      return builder;
    },
  }),
}));

const { getViewer } = await import("./viewer");

beforeEach(() => {
  Object.assign(db, { configured: true, signedIn: true, profile: null, error: null, filters: [] });
});

describe("getViewer", () => {
  it("is a visitor when nobody is signed in", async () => {
    db.signedIn = false;
    expect(await getViewer()).toEqual({ kind: "visitor" });
  });

  it("is a visitor when Supabase isn't configured", async () => {
    db.configured = false;
    expect(await getViewer()).toEqual({ kind: "visitor" });
  });

  it("reads the signed-in member's own level and expiry", async () => {
    db.profile = { level: "band", expires_at: "2027-07-04T00:00:00+00:00" };
    expect(await getViewer()).toEqual({
      kind: "member",
      userId: BAND_ID,
      level: "band",
      expiresAt: "2027-07-04T00:00:00+00:00",
    });
    expect(db.filters).toEqual([["id", BAND_ID]]);
  });

  it("gives a member who never paid no level or expiry", async () => {
    db.profile = { level: null, expires_at: null };
    expect(await getViewer()).toEqual({
      kind: "member",
      userId: BAND_ID,
      level: null,
      expiresAt: null,
    });
  });

  it("treats a missing profile or an unknown level as no membership", async () => {
    expect(await getViewer()).toMatchObject({ level: null, expiresAt: null });
    db.profile = { level: "family", expires_at: 1 };
    expect(await getViewer()).toMatchObject({ level: null, expiresAt: null });
  });

  it("throws when the profile can't be read", async () => {
    db.error = { code: "PGRST000", message: "connection refused" };
    await expect(getViewer()).rejects.toThrow(
      "Reading the member's profile failed: PGRST000 connection refused",
    );
  });
});
