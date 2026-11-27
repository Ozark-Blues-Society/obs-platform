// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const MEMBER_ID = "00000000-0000-4000-8100-000000000036";

// A stand-in for Supabase: the session (getClaims) and the caller's profile row.
const db = vi.hoisted(() => ({
  signedIn: true,
  profile: null as object | null,
  error: null as { code: string; message: string } | null,
  calls: [] as [string, ...unknown[]][],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: MEMBER_ID, email: "curtis.bell@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => {
      db.calls.push(["from", table]);
      const builder = {
        select: (columns: string) => {
          db.calls.push(["select", columns]);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          db.calls.push(["eq", column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: db.profile, error: db.error }),
      };
      return builder;
    },
  }),
}));

const { getMyAccount } = await import("./my-account");

beforeEach(() => {
  Object.assign(db, { signedIn: true, profile: null, error: null, calls: [] });
});

describe("getMyAccount", () => {
  it("reads the signed-in member's own row, without the staff notes", async () => {
    db.profile = {
      email: "curtis.bell@example.com",
      first_name: "Curtis",
      last_name: "Bell",
      phone: "(479) 555-0136",
      level: "sponsor",
      expires_at: "2027-05-06T17:00:00+00:00",
      auto_renew: false,
      joined_at: "2024-05-06T17:00:00+00:00",
    };

    expect(await getMyAccount()).toEqual({
      email: "curtis.bell@example.com",
      firstName: "Curtis",
      lastName: "Bell",
      phone: "(479) 555-0136",
      level: "sponsor",
      expiresAt: "2027-05-06T17:00:00+00:00",
      autoRenew: false,
      joinedAt: "2024-05-06T17:00:00+00:00",
    });
    expect(db.calls).toEqual([
      ["from", "profiles"],
      ["select", "email, first_name, last_name, phone, level, expires_at, auto_renew, joined_at"],
      ["eq", "id", MEMBER_ID],
    ]);
  });

  it("has no membership before the first payment, and no blanks for empty fields", async () => {
    db.profile = {
      email: "new.member@example.com",
      first_name: " ",
      last_name: null,
      phone: "",
      level: null,
      expires_at: null,
      auto_renew: false,
      joined_at: null,
    };
    expect(await getMyAccount()).toEqual({
      email: "new.member@example.com",
      firstName: null,
      lastName: null,
      phone: null,
      level: null,
      expiresAt: null,
      autoRenew: false,
      joinedAt: null,
    });
  });

  it("falls back to the session's address when there's no profile row", async () => {
    expect(await getMyAccount()).toMatchObject({
      email: "curtis.bell@example.com",
      level: null,
      expiresAt: null,
      autoRenew: false,
    });
  });

  it("ignores a level it doesn't know", async () => {
    db.profile = { email: "x@example.com", level: "family", expires_at: "2027-01-01T00:00:00Z" };
    expect(await getMyAccount()).toMatchObject({ level: null });
  });

  it("sends a visitor to sign in, back to My Account", async () => {
    db.signedIn = false;
    await expect(getMyAccount()).rejects.toThrow("NEXT_REDIRECT /sign-in?next=%2Faccount");
    expect(db.calls).toEqual([]);
  });

  it("throws when the profile can't be read", async () => {
    db.error = { code: "08006", message: "connection failure" };
    await expect(getMyAccount()).rejects.toThrow(
      "Reading the member's profile failed: 08006 connection failure",
    );
  });
});
