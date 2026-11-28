// @vitest-environment node
// My listings' Server Functions with stand-ins for Supabase. supabase/tests/listing_renewal_test.sql
// tests the renewal rules in the database, and e2e/my-listings.spec.ts both functions against it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MY_LISTINGS_MESSAGES } from "./my-listings-state";

const MEMBER_ID = "00000000-0000-4000-8100-000000000019";
const LISTING_ID = "00000000-0000-4000-8200-000000000003";
const PHOTO = `${MEMBER_ID}/00000000-0000-4000-8950-000000000001.jpg`;

// Stand-ins for Supabase, as the signed-in member (`member`) and with the service role (`admin`).
// Every call is recorded in `calls`.
const { db, query } = vi.hoisted(() => {
  const db = {
    signedIn: true,
    /** What renew_listing() returns: the renewed row, or none. */
    renewed: [] as object[],
    rpcError: null as { code: string; message: string } | null,
    /** The row the member's delete returns: null when it matched none. */
    deleted: null as object | null,
    deleteError: null as { code: string; message: string } | null,
    /** The listing as a read finds it after a refused renewal. */
    current: null as object | null,
    profile: null as object | null,
    removeError: null as { message: string } | null,
    calls: [] as unknown[][],
  };
  type Result = { data: unknown; error: unknown };
  const result = (table: string, op: string): Result => {
    if (table === "listings" && op === "delete") {
      return { data: db.deleteError ? null : db.deleted, error: db.deleteError };
    }
    if (table === "listings") return { data: db.current, error: null };
    return { data: db.profile, error: null };
  };
  const query = (client: string, table: string) => {
    let op = "select";
    const builder = {
      select: (columns: string) => (db.calls.push([client, table, "select", columns]), builder),
      delete: () => {
        op = "delete";
        db.calls.push([client, table, "delete"]);
        return builder;
      },
      eq: (column: string, value: unknown) => (
        db.calls.push([client, table, "eq", column, value]),
        builder
      ),
      order: () => builder,
      maybeSingle: async () => result(table, op),
    };
    return builder;
  };
  return { db, query };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("next/cache", () => ({ refresh: () => db.calls.push(["refresh"]) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: MEMBER_ID, email: "marcus.lane@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => query("member", table),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          db.calls.push(["member", "storage", bucket, "remove", paths]);
          return { data: db.removeError ? null : [], error: db.removeError };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: object) => {
      db.calls.push(["admin", "rpc", name, args]);
      return { data: db.rpcError ? null : db.renewed, error: db.rpcError };
    },
  }),
}));

const { removeListing, renewListing } = await import("./my-listings-actions");

const callsBy = (client: string) => db.calls.filter((call) => call[0] === client);

beforeEach(() => {
  db.signedIn = true;
  db.renewed = [];
  db.rpcError = null;
  db.deleted = null;
  db.deleteError = null;
  db.current = null;
  // An active Band member.
  db.profile = { level: "band", expires_at: "2099-01-01T00:00:00Z", phone: null };
  db.removeError = null;
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("renewListing", () => {
  it("renews with the service role, for the member the session names, and shows the new end", async () => {
    db.renewed = [{ id: LISTING_ID, title: "Tweed amp", expires_at: "2027-01-26T18:00:00Z" }];

    const result = await renewListing({ id: LISTING_ID });

    expect(result).toEqual({
      status: "renewed",
      message: "“Tweed amp” is renewed: it's on the classifieds until Jan 26, 2027.",
    });
    expect(callsBy("admin")).toEqual([
      ["admin", "rpc", "renew_listing", { p_listing_id: LISTING_ID, p_profile_id: MEMBER_ID }],
    ]);
    expect(db.calls).toContainEqual(["refresh"]);
  });

  it("sends a visitor to sign in, and renews nothing", async () => {
    db.signedIn = false;

    await expect(renewListing({ id: LISTING_ID })).rejects.toThrow(
      "redirect /sign-in?next=%2Faccount%2Flistings",
    );
    expect(callsBy("admin")).toEqual([]);
  });

  it.each([["not a listing id"], [42], [undefined]])(
    "refuses %j, which My listings never sends, without asking the database",
    async (id) => {
      expect(await renewListing({ id })).toEqual({
        status: "error",
        message: MY_LISTINGS_MESSAGES.unavailable,
      });
      expect(callsBy("admin")).toEqual([]);
    },
  );

  it("explains a refused renewal: the listing can't be renewed yet", async () => {
    db.current = {
      ...{ id: LISTING_ID, category: "gear", title: "Tweed amp", price: 650, status: "live" },
      ...{ reject_reason: null, created_at: "2026-11-01T15:00:00Z" },
      // Already renewed, in another tab perhaps.
      expires_at: "2099-01-26T18:00:00Z",
    };

    const result = await renewListing({ id: LISTING_ID });

    expect(result).toEqual({
      status: "error",
      message:
        "“Tweed amp” is on the classifieds until Jan 26, 2099. You can renew it from Jan 21, 2099.",
    });
    // It reads the member's own listing, as the member.
    expect(callsBy("member")).toContainEqual(["member", "listings", "eq", "profile_id", MEMBER_ID]);
    expect(callsBy("member")).toContainEqual(["member", "listings", "eq", "id", LISTING_ID]);
  });

  it("asks a member whose membership has ended to renew it first", async () => {
    db.current = {
      ...{ id: LISTING_ID, category: "gear", title: "Tweed amp", price: 650, status: "expired" },
      ...{ reject_reason: null, created_at: "2026-09-01T15:00:00Z" },
      expires_at: "2026-11-01T18:00:00Z",
    };
    db.profile = { level: "band", expires_at: "2026-11-20T00:00:00Z", phone: null };

    expect(await renewListing({ id: LISTING_ID })).toEqual({
      status: "error",
      message: MY_LISTINGS_MESSAGES.renew,
    });
  });

  it("says the listing is gone when the member has no such listing", async () => {
    expect(await renewListing({ id: LISTING_ID })).toEqual({
      status: "error",
      message: MY_LISTINGS_MESSAGES.gone,
    });
  });

  it("reports a database error without details", async () => {
    db.rpcError = { code: "57014", message: "canceling statement due to statement timeout" };

    expect(await renewListing({ id: LISTING_ID })).toEqual({
      status: "error",
      message: MY_LISTINGS_MESSAGES.unavailable,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Renewing a listing failed:",
      "57014",
      "canceling statement due to statement timeout",
    );
  });
});

describe("removeListing", () => {
  it("deletes the member's own listing as the member, then its photo", async () => {
    db.deleted = { title: "Tweed amp", photo_path: PHOTO };

    const result = await removeListing({ id: LISTING_ID });

    expect(result).toEqual({
      status: "removed",
      message: "“Tweed amp” is removed. It's no longer on the classifieds.",
    });
    expect(callsBy("member")).toEqual([
      ["member", "listings", "delete"],
      ["member", "listings", "eq", "id", LISTING_ID],
      ["member", "listings", "eq", "profile_id", MEMBER_ID],
      ["member", "listings", "select", "title, photo_path"],
      ["member", "storage", "listing-photos", "remove", [PHOTO]],
    ]);
    expect(callsBy("admin")).toEqual([]);
    expect(db.calls).toContainEqual(["refresh"]);
  });

  it("removes no photo for a listing without one", async () => {
    db.deleted = { title: "Carpool", photo_path: null };

    expect((await removeListing({ id: LISTING_ID })).status).toBe("removed");
    expect(db.calls.some((call) => call[1] === "storage")).toBe(false);
  });

  it("still reports the listing removed when its photo couldn't be", async () => {
    db.deleted = { title: "Tweed amp", photo_path: PHOTO };
    db.removeError = { message: "Storage is down" };

    expect((await removeListing({ id: LISTING_ID })).status).toBe("removed");
    expect(console.error).toHaveBeenCalledWith(
      "Removing a listing's photo failed:",
      "Storage is down",
    );
  });

  it("says the listing is gone when nothing was deleted", async () => {
    expect(await removeListing({ id: LISTING_ID })).toEqual({
      status: "error",
      message: MY_LISTINGS_MESSAGES.gone,
    });
  });

  it("reports a database error without details", async () => {
    db.deleteError = { code: "42501", message: "permission denied" };

    expect(await removeListing({ id: LISTING_ID })).toEqual({
      status: "error",
      message: MY_LISTINGS_MESSAGES.unavailable,
    });
  });

  it("refuses an id My listings never sends, and sends a visitor to sign in", async () => {
    expect((await removeListing({ id: "../profiles" })).status).toBe("error");
    expect(db.calls).toEqual([]);

    db.signedIn = false;
    await expect(removeListing({ id: LISTING_ID })).rejects.toThrow(/^redirect \/sign-in/);
  });
});
