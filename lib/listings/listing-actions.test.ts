// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LISTING_MESSAGES } from "./listing-state";

const MEMBER_ID = "00000000-0000-4000-8100-000000000019";
const OTHER_ID = "00000000-0000-4000-8100-000000000018";
const PHOTO_PATH = `${MEMBER_ID}/3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b.jpg`;
const DAY = 24 * 60 * 60 * 1000;

// A stand-in for Supabase as the signed-in member: their profile, Storage and the listings table.
// Every call is recorded in `calls`.
const db = vi.hoisted(() => ({
  signedIn: true,
  profile: null as object | null,
  profileError: null as { code: string; message: string } | null,
  signUploadError: null as object | null,
  info: { size: 1234, contentType: "image/jpeg" } as object | null,
  insertError: null as { code: string; message: string } | null,
  calls: [] as unknown[][],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: MEMBER_ID, email: "marcus.lane@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => {
      const builder = {
        select: (columns: string) => {
          db.calls.push(["select", table, columns]);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          db.calls.push(["eq", table, column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: db.profile, error: db.profileError }),
        insert: async (values: object) => {
          db.calls.push(["insert", table, values]);
          return { error: db.insertError };
        },
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: async (path: string) => {
          db.calls.push(["signUpload", bucket, path]);
          return db.signUploadError
            ? { data: null, error: db.signUploadError }
            : { data: { path, signedUrl: `http://storage/upload/${path}?token=t` }, error: null };
        },
        info: async (path: string) => {
          db.calls.push(["info", bucket, path]);
          return db.info
            ? { data: db.info, error: null }
            : { data: null, error: { message: "Not found" } };
        },
        remove: async (paths: string[]) => {
          db.calls.push(["remove", bucket, paths]);
          return { data: [], error: null };
        },
      }),
    },
  }),
}));

const { preparePhotoUpload, submitListing } = await import("./listing-actions");

const activeProfile = (phone: string | null = "(479) 555-0119") => ({
  level: "band",
  expires_at: new Date(Date.now() + 75 * DAY).toISOString(),
  phone,
});

beforeEach(() => {
  Object.assign(db, {
    signedIn: true,
    profile: activeProfile(),
    profileError: null,
    signUploadError: null,
    info: { size: 1234, contentType: "image/jpeg" },
    insertError: null,
    calls: [],
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const callsOf = (kind: string) => db.calls.filter((call) => call[0] === kind);

const LISTING = {
  category: "gear",
  title: " Tweed-style 1x12 tube amp ",
  body: "Hand-wired.\r\nLocal pickup only.",
  price: "650",
  contactPref: "phone",
  photoPath: null,
};

describe("preparePhotoUpload", () => {
  it("gives an active member a one-time upload link for a new photo in their own folder", async () => {
    const result = await preparePhotoUpload({ size: 2_000_000, type: "image/jpeg" });

    const [[, bucket, path]] = callsOf("signUpload");
    expect(bucket).toBe("listing-photos");
    expect(path).toMatch(new RegExp(`^${MEMBER_ID}/[0-9a-f-]{36}\\.jpg$`));
    expect(result).toEqual({
      status: "ready",
      path,
      uploadUrl: `http://storage/upload/${path}?token=t`,
    });
    // The membership comes from the member's own profile.
    expect(db.calls).toContainEqual(["eq", "profiles", "id", MEMBER_ID]);
  });

  it("refuses a photo of the wrong type or size before asking Storage", async () => {
    expect(await preparePhotoUpload({ size: 1000, type: "image/gif" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.photoType,
    });
    expect(await preparePhotoUpload({ size: 11 * 1024 * 1024, type: "image/png" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.photoTooBig,
    });
    expect(callsOf("signUpload")).toEqual([]);
  });

  it("refuses members whose membership has ended, and members who never paid", async () => {
    db.profile = { ...activeProfile(), expires_at: new Date(Date.now() - DAY).toISOString() };
    expect(await preparePhotoUpload({ size: 1000, type: "image/png" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.renew,
    });
    db.profile = { level: null, expires_at: null, phone: null };
    expect(await preparePhotoUpload({ size: 1000, type: "image/png" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.join,
    });
    expect(callsOf("signUpload")).toEqual([]);
  });

  it("sends a visitor to sign in", async () => {
    db.signedIn = false;
    await expect(preparePhotoUpload({ size: 1000, type: "image/png" })).rejects.toThrow(
      "redirect /sign-in?next=%2Faccount%2Flistings%2Fnew",
    );
    expect(db.calls).toEqual([]);
  });

  it("says to try again when Storage or the profile can't be reached", async () => {
    db.signUploadError = { message: "new row violates row-level security policy" };
    expect(await preparePhotoUpload({ size: 1000, type: "image/png" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.unavailable,
    });
    db.profileError = { code: "PGRST000", message: "down" };
    expect(await preparePhotoUpload({ size: 1000, type: "image/png" })).toEqual({
      status: "error",
      message: LISTING_MESSAGES.unavailable,
    });
  });
});

describe("submitListing", () => {
  it("adds an active member's listing, tidied, for a moderator to review", async () => {
    const result = await submitListing(LISTING);

    expect(result).toEqual({ status: "submitted", title: "Tweed-style 1x12 tube amp" });
    // Only what the poster wrote: the database gives the poster, the pending status and the dates.
    expect(callsOf("insert")).toEqual([
      [
        "insert",
        "listings",
        {
          category: "gear",
          title: "Tweed-style 1x12 tube amp",
          body: "Hand-wired.\nLocal pickup only.",
          price: 650,
          contact_pref: "phone",
          photo_path: null,
        },
      ],
    ]);
    expect(callsOf("info")).toEqual([]);
  });

  it("adds a listing with its photo once Storage has the photo", async () => {
    const result = await submitListing({ ...LISTING, price: "", photoPath: PHOTO_PATH });

    expect(result.status).toBe("submitted");
    expect(callsOf("info")).toEqual([["info", "listing-photos", PHOTO_PATH]]);
    expect(callsOf("insert")[0][2]).toMatchObject({ price: null, photo_path: PHOTO_PATH });
  });

  it("refuses members whose membership has ended, and members who never paid", async () => {
    db.profile = { ...activeProfile(), expires_at: new Date(Date.now() - DAY).toISOString() };
    expect(await submitListing(LISTING)).toEqual({
      status: "error",
      field: null,
      message: LISTING_MESSAGES.renew,
    });
    db.profile = null;
    expect(await submitListing(LISTING)).toEqual({
      status: "error",
      field: null,
      message: LISTING_MESSAGES.join,
    });
    expect(callsOf("insert")).toEqual([]);
  });

  it("names the field to fix and adds nothing", async () => {
    expect(await submitListing({ ...LISTING, title: "" })).toEqual({
      status: "error",
      field: "title",
      message: LISTING_MESSAGES.titleMissing,
    });
    expect(await submitListing({ ...LISTING, category: "lessons" })).toEqual({
      status: "error",
      field: "category",
      message: LISTING_MESSAGES.categoryMissing,
    });
    db.profile = activeProfile(null);
    expect(await submitListing(LISTING)).toEqual({
      status: "error",
      field: "contactPref",
      message: LISTING_MESSAGES.phoneMissing,
    });
    expect(callsOf("insert")).toEqual([]);
  });

  it("refuses a photo path the upload step didn't make for this member", async () => {
    for (const photoPath of [
      `${OTHER_ID}/3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b.jpg`,
      `${MEMBER_ID}/photo.gif`,
      42,
    ]) {
      expect(await submitListing({ ...LISTING, photoPath }), String(photoPath)).toEqual({
        status: "error",
        field: null,
        message: LISTING_MESSAGES.unavailable,
      });
    }
    expect(callsOf("info")).toEqual([]);
    expect(callsOf("insert")).toEqual([]);
  });

  it("doesn't add the listing when its photo never reached Storage", async () => {
    db.info = null;
    expect(await submitListing({ ...LISTING, photoPath: PHOTO_PATH })).toEqual({
      status: "error",
      field: "photo",
      message: LISTING_MESSAGES.photoNotUploaded,
    });
    expect(callsOf("insert")).toEqual([]);
  });

  it("removes the uploaded photo when the listing can't be added", async () => {
    db.insertError = { code: "42501", message: "new row violates row-level security policy" };
    expect(await submitListing({ ...LISTING, photoPath: PHOTO_PATH })).toEqual({
      status: "error",
      field: null,
      message: LISTING_MESSAGES.unavailable,
    });
    expect(callsOf("remove")).toEqual([["remove", "listing-photos", [PHOTO_PATH]]]);
  });

  it("sends a visitor to sign in", async () => {
    db.signedIn = false;
    await expect(submitListing(LISTING)).rejects.toThrow(
      "redirect /sign-in?next=%2Faccount%2Flistings%2Fnew",
    );
    expect(callsOf("insert")).toEqual([]);
  });

  it("says to try again when the profile can't be read", async () => {
    db.profileError = { code: "PGRST000", message: "down" };
    expect(await submitListing(LISTING)).toEqual({
      status: "error",
      field: null,
      message: LISTING_MESSAGES.unavailable,
    });
    expect(callsOf("insert")).toEqual([]);
  });
});
