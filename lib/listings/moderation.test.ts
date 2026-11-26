// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice, posterName } from "./moderation-state";

const PAT = "00000000-0000-4000-8100-000000000022";
const RUTH = "00000000-0000-4000-8100-000000000020";

const row = (overrides: object) => ({
  id: "00000000-0000-4000-8200-000000000005",
  revision: 1,
  profile_id: RUTH,
  category: "musicians_wanted",
  title: "Keys player wanted",
  body: "Hammond experience a plus.",
  price: null,
  photo_path: null,
  photo_version: null,
  contact_pref: "email",
  created_at: "2026-11-24T18:00:00+00:00",
  ...overrides,
});

// Stand-ins for Supabase as the moderator (listings, Storage) and with the service role (names).
const db = vi.hoisted(() => ({
  rows: [] as object[],
  listError: null as { code: string; message: string } | null,
  profiles: [] as object[],
  profilesError: null as { code: string; message: string } | null,
  /** Paths whose signing fails, as for a photo replaced in Storage. */
  unsignable: new Set<string>(),
  calls: [] as unknown[][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {
        select: (columns: string) => (db.calls.push(["select", table, columns]), builder),
        eq: (column: string, value: unknown) => (db.calls.push(["eq", column, value]), builder),
        order: (column: string, options: object) => {
          db.calls.push(["order", column, options]);
          return builder;
        },
        then: (resolve: (value: object) => unknown) =>
          Promise.resolve({ data: db.listError ? null : db.rows, error: db.listError }).then(
            resolve,
          ),
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiresIn: number, options: object) => {
          db.calls.push(["sign", bucket, path, expiresIn, options]);
          return db.unsignable.has(path)
            ? { data: null, error: { message: "Object not found" } }
            : { data: { signedUrl: `http://storage/sign/${path}?token=t` }, error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        in: async (column: string, ids: string[]) => {
          db.calls.push(["names", column, ids]);
          return { data: db.profilesError ? null : db.profiles, error: db.profilesError };
        },
      }),
    }),
  }),
}));

const { listPendingListings } = await import("./moderation");

beforeEach(() => {
  db.rows = [];
  db.listError = null;
  db.profiles = [];
  db.profilesError = null;
  db.unsignable = new Set();
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listPendingListings", () => {
  it("reads the pending listings oldest first, with names and photo links for the version kept", async () => {
    const photo = `${PAT}/3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b.jpg`;
    db.rows = [
      row({ profile_id: RUTH }),
      row({
        id: "00000000-0000-4000-8200-000000000004",
        profile_id: PAT,
        revision: 2,
        category: "gear",
        title: "Harmonica set",
        price: 120,
        photo_path: photo,
        photo_version: "v-reviewed",
        contact_pref: "phone",
      }),
      row({ id: "00000000-0000-4000-8200-000000000012", profile_id: PAT }),
    ];
    db.profiles = [
      { id: PAT, first_name: "Pat", last_name: "Walsh" },
      { id: RUTH, first_name: " ", last_name: "Abbott" },
    ];

    const listings = await listPendingListings();

    expect(db.calls).toContainEqual(["eq", "status", "pending"]);
    expect(db.calls.filter((call) => call[0] === "order")).toEqual([
      ["order", "created_at", { ascending: true }],
      ["order", "id", { ascending: true }],
    ]);
    // Each poster once, through the service role.
    expect(db.calls).toContainEqual(["names", "id", [RUTH, PAT]]);
    expect(db.calls).toContainEqual([
      "sign",
      "listing-photos",
      photo,
      3600,
      { versionId: "v-reviewed" },
    ]);
    expect(listings[0]).toMatchObject({ poster: null, photo: null, contactPref: "email" });
    expect(listings[1]).toEqual({
      id: "00000000-0000-4000-8200-000000000004",
      revision: 2,
      category: "gear",
      title: "Harmonica set",
      body: "Hammond experience a plus.",
      price: 120,
      contactPref: "phone",
      submittedAt: "2026-11-24T18:00:00+00:00",
      poster: "Pat W.",
      photo: { status: "shown", url: `http://storage/sign/${photo}?token=t` },
    });
    expect(listings[2].poster).toBe("Pat W.");
  });

  it("marks a photo that can't be signed, such as one replaced in Storage", async () => {
    const photo = `${PAT}/3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b.png`;
    db.rows = [row({ photo_path: photo, photo_version: "v1" })];
    db.unsignable.add(photo);

    expect((await listPendingListings())[0].photo).toEqual({ status: "missing" });
  });

  it("still lists the listings when the names can't be read", async () => {
    db.rows = [row({})];
    db.profilesError = { code: "PGRST301", message: "JWT invalid" };

    const listings = await listPendingListings();

    expect(listings).toHaveLength(1);
    expect(listings[0].poster).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("throws when the listings can't be read", async () => {
    db.listError = { code: "08006", message: "connection failure" };

    await expect(listPendingListings()).rejects.toThrow("08006");
  });

  it("asks for no names when nothing is waiting", async () => {
    expect(await listPendingListings()).toEqual([]);
    expect(db.calls.some((call) => call[0] === "names")).toBe(false);
  });
});

describe("posterName", () => {
  it.each([
    ["Pat", "Walsh", "Pat W."],
    [" Ruth ", " abbott", "Ruth A."],
    ["Dale", null, "Dale"],
    ["", "Walsh", null],
    [null, null, null],
  ])("%o %o → %o", (first, last, name) => {
    expect(posterName(first, last)).toBe(name);
  });
});

describe("formatPrice", () => {
  it.each([
    [650, "$650"],
    [1200, "$1,200"],
    [19.99, "$19.99"],
    [19.5, "$19.50"],
  ])("%d → %s", (price, text) => {
    expect(formatPrice(price)).toBe(text);
  });
});
