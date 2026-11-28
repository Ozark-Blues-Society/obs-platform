// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const VIEWER_ID = "00000000-0000-4000-8100-000000000031";
const POSTER_ID = "00000000-0000-4000-8100-000000000014";
const LISTING_ID = "00000000-0000-4000-8200-000000000003";
const PHOTO_PATH = `${POSTER_ID}/9b1e7c58-4f8e-4d7e-9a43-3f1c2b7a6d10.jpg`;

// Stand-ins for Supabase, as the viewer (`member`, or a visitor when `signedIn` is false) and with
// the service role (`admin`). Every call is recorded in `calls`.
const { db, query } = vi.hoisted(() => {
  const db = {
    signedIn: true,
    viewerId: "",
    /** What the listings read finds: rows for the list, one row (or null) for a page. */
    listings: [] as object[],
    listing: null as object | null,
    listingsError: null as { code: string; message: string } | null,
    profiles: [] as object[],
    profile: null as object | null,
    /** The signed-in viewer's own profile, which the member client reads for the form's defaults. */
    viewerProfile: null as object | null,
    profileError: null as { code: string; message: string } | null,
    signError: null as { message: string } | null,
    calls: [] as unknown[][],
  };
  type Result = { data: unknown; error: unknown };
  const result = (client: string, table: string, single: boolean): Result => {
    if (table === "listings") {
      return { data: single ? db.listing : db.listings, error: db.listingsError };
    }
    if (client === "member") return { data: db.viewerProfile, error: null };
    return { data: single ? db.profile : db.profiles, error: db.profileError };
  };
  const query = (client: string, table: string) => {
    const record =
      (name: string) =>
      (...args: unknown[]) => (db.calls.push([client, table, name, ...args]), builder);
    const builder = {
      select: record("select"),
      eq: record("eq"),
      gt: record("gt"),
      in: record("in"),
      order: record("order"),
      maybeSingle: async () => result(client, table, true),
      then: (resolve: (value: Result) => unknown) =>
        Promise.resolve(result(client, table, false)).then(resolve),
    };
    return builder;
  };
  return { db, query };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: db.viewerId, email: "jo.ames@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => query("member", table),
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, seconds: number, options: object) => {
          db.calls.push(["member", "storage", bucket, path, seconds, options]);
          return db.signError
            ? { data: null, error: db.signError }
            : { data: { signedUrl: `https://storage.example.org/${path}?token=t` }, error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => query("admin", table) }),
}));

const { contactFor, getLiveListing, listLiveListings, profilePhone } = await import("./public");

const ROW = {
  id: LISTING_ID,
  profile_id: POSTER_ID,
  category: "gear",
  title: "Tweed-style 1x12 tube amp, 15 W",
  body: "Hand-wired.",
  price: 650,
  approved_at: "2026-11-08T18:00:00+00:00",
  photo_path: null,
  photo_version: null,
  contact_pref: "email",
};

const adminSelects = () =>
  db.calls.filter((call) => call[0] === "admin" && call[2] === "select").map((call) => call[3]);

beforeEach(() => {
  db.signedIn = true;
  db.viewerId = VIEWER_ID;
  db.listings = [];
  db.listing = { ...ROW };
  db.listingsError = null;
  db.profiles = [];
  db.profile = { first_name: "Lou", last_name: "Tate", phone: "(479) 555-0142" };
  db.profileError = null;
  db.viewerProfile = { first_name: "Jo", last_name: "Ames" };
  db.signError = null;
  db.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listLiveListings", () => {
  it("reads the live listings, newest first, with their posters' names", async () => {
    db.listings = [
      { ...ROW, id: "a", profile_id: POSTER_ID },
      { ...ROW, id: "b", profile_id: VIEWER_ID },
    ];
    db.profiles = [{ id: POSTER_ID, first_name: "Lou", last_name: "Tate" }];

    const listings = await listLiveListings(null);

    expect(listings.map(({ id, poster }) => [id, poster])).toEqual([
      ["a", "Lou T."],
      ["b", null],
    ]);
    expect(listings[0]).toEqual({
      id: "a",
      category: "gear",
      title: ROW.title,
      body: ROW.body,
      price: 650,
      postedAt: ROW.approved_at,
      poster: "Lou T.",
    });
    expect(db.calls).toContainEqual(["member", "listings", "eq", "status", "live"]);
    expect(db.calls).toContainEqual(["member", "listings", "gt", "expires_at", expect.any(String)]);
    expect(db.calls).toContainEqual([
      "member",
      "listings",
      "order",
      "approved_at",
      { ascending: false },
    ]);
    expect(db.calls.some((call) => call[2] === "eq" && call[3] === "category")).toBe(false);
    // Names only: never an address or a phone number.
    expect(adminSelects()).toEqual(["id, first_name, last_name"]);
  });

  it("reads one category", async () => {
    await listLiveListings("street_team");
    expect(db.calls).toContainEqual(["member", "listings", "eq", "category", "street_team"]);
  });

  it("throws when the listings can't be read", async () => {
    db.listingsError = { code: "57014", message: "canceling statement due to statement timeout" };
    await expect(listLiveListings(null)).rejects.toThrow("Reading the live listings failed");
  });

  it("still lists the listings when the names can't be read", async () => {
    db.listings = [{ ...ROW }];
    db.profileError = { code: "57014", message: "timeout" };
    expect((await listLiveListings(null))[0].poster).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("getLiveListing", () => {
  it("doesn't read anything for an address no listing could have", async () => {
    expect(await getLiveListing("amp")).toBeNull();
    expect(db.calls).toEqual([]);
  });

  it("finds only a live listing", async () => {
    db.listing = null;
    expect(await getLiveListing(LISTING_ID)).toBeNull();
    expect(db.calls).toContainEqual(["member", "listings", "eq", "id", LISTING_ID]);
    expect(db.calls).toContainEqual(["member", "listings", "eq", "status", "live"]);
    expect(db.calls).toContainEqual(["member", "listings", "gt", "expires_at", expect.any(String)]);
  });

  it("lets a visitor write, with an empty form, and never gives them the number", async () => {
    db.signedIn = false;
    db.listing = { ...ROW, contact_pref: "phone" };

    const listing = await getLiveListing(LISTING_ID);

    expect(listing).toMatchObject({
      poster: "Lou T.",
      photo: null,
      contact: { kind: "message", phoneForMembers: true, defaults: { name: "", email: "" } },
    });
    expect(JSON.stringify(listing)).not.toContain("555-0142");
    expect(db.calls.some((call) => call[0] === "member" && call[1] === "profiles")).toBe(false);
  });

  it("gives a signed-in viewer the number of a poster who asked for calls", async () => {
    db.listing = { ...ROW, contact_pref: "phone" };
    expect((await getLiveListing(LISTING_ID))?.contact).toEqual({
      kind: "phone",
      phone: "(479) 555-0142",
    });
    expect(adminSelects()).toEqual(["first_name, last_name, phone"]);
  });

  it("lets everyone write when the poster asked for calls but has no number any more", async () => {
    db.listing = { ...ROW, contact_pref: "phone" };
    db.profile = { first_name: "Lou", last_name: "Tate", phone: " " };
    expect((await getLiveListing(LISTING_ID))?.contact).toMatchObject({
      kind: "message",
      phoneForMembers: false,
    });
  });

  it("fills in a signed-in viewer's own name and address for a poster who chose email", async () => {
    expect((await getLiveListing(LISTING_ID))?.contact).toEqual({
      kind: "message",
      phoneForMembers: false,
      defaults: { name: "Jo Ames", email: "jo.ames@example.com" },
    });
    expect(adminSelects()).toEqual(["first_name, last_name"]);
    expect(db.calls).toContainEqual(["member", "profiles", "eq", "id", VIEWER_ID]);
  });

  it("tells the poster it's their own listing", async () => {
    db.viewerId = POSTER_ID;
    db.listing = { ...ROW, contact_pref: "phone" };
    expect((await getLiveListing(LISTING_ID))?.contact).toEqual({ kind: "own" });
    expect(adminSelects()).toEqual(["first_name, last_name"]);
  });

  it("lets everyone write, with no name, when the poster can't be read", async () => {
    db.listing = { ...ROW, contact_pref: "phone" };
    db.profileError = { code: "57014", message: "timeout" };
    expect(await getLiveListing(LISTING_ID)).toMatchObject({
      poster: null,
      contact: { kind: "message", phoneForMembers: false },
    });
  });

  it("links to the photo as the moderator approved it: that version, for an hour", async () => {
    db.listing = { ...ROW, photo_path: PHOTO_PATH, photo_version: "v-approved" };
    expect((await getLiveListing(LISTING_ID))?.photo).toEqual({
      status: "shown",
      url: `https://storage.example.org/${PHOTO_PATH}?token=t`,
    });
    expect(db.calls).toContainEqual([
      "member",
      "storage",
      "listing-photos",
      PHOTO_PATH,
      3600,
      { versionId: "v-approved" },
    ]);
  });

  it("shows no photo when it was replaced since, or the listing keeps no version of it", async () => {
    db.listing = { ...ROW, photo_path: PHOTO_PATH, photo_version: "v-approved" };
    db.signError = { message: "Object not found" };
    expect((await getLiveListing(LISTING_ID))?.photo).toEqual({ status: "missing" });

    db.listing = { ...ROW, photo_path: PHOTO_PATH, photo_version: null };
    db.calls = [];
    expect((await getLiveListing(LISTING_ID))?.photo).toEqual({ status: "missing" });
    expect(db.calls.some((call) => call[1] === "storage")).toBe(false);
  });

  it("throws when the listing can't be read", async () => {
    db.listingsError = { code: "57014", message: "timeout" };
    await expect(getLiveListing(LISTING_ID)).rejects.toThrow(`Reading listing ${LISTING_ID}`);
  });
});

describe("contactFor and profilePhone", () => {
  const row = { profile_id: POSTER_ID, contact_pref: "phone" as const };
  const viewer = { id: VIEWER_ID, email: "jo.ames@example.com" };
  const defaults = { name: "Jo Ames", email: "jo.ames@example.com" };
  const empty = { name: "", email: "" };

  it("picks how the viewer reaches the poster", () => {
    expect(contactFor(row, null, "(479) 555-0142", empty)).toEqual({
      kind: "message",
      phoneForMembers: true,
      defaults: empty,
    });
    expect(contactFor(row, { ...viewer, id: POSTER_ID }, "(479) 555-0142", defaults)).toEqual({
      kind: "own",
    });
    expect(contactFor(row, viewer, "(479) 555-0142", defaults)).toEqual({
      kind: "phone",
      phone: "(479) 555-0142",
    });
    expect(contactFor(row, viewer, null, defaults)).toEqual({
      kind: "message",
      phoneForMembers: false,
      defaults,
    });
    expect(
      contactFor({ ...row, contact_pref: "email" }, viewer, "(479) 555-0142", defaults),
    ).toEqual({ kind: "message", phoneForMembers: false, defaults });
  });

  it("reads a profile's number, or none", () => {
    expect(profilePhone(" (479) 555-0142 ")).toBe("(479) 555-0142");
    expect(profilePhone("  ")).toBeNull();
    expect(profilePhone(null)).toBeNull();
  });
});
