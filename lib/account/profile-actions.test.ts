// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { PROFILE_MESSAGES, type ProfileState } from "./profile-state";

const MEMBER_ID = "00000000-0000-4000-8100-000000000002";

type DbError = { code: string; message: string } | null;
type Query = { op: "select" | "update"; columns?: string; filters: object; values?: object };

// A stand-in for Supabase. The caller is signed in as MEMBER_ID unless `signedIn` is false. Reading
// the profile answers `profile`; an update answers `updated` rows. Every query is recorded.
const db = vi.hoisted(() => ({
  signedIn: true,
  profile: null as object | null,
  readError: null as DbError,
  updated: [] as object[],
  updateError: null as DbError,
  throws: false,
  queries: [] as Query[],
}));

const refresh = vi.hoisted(() => vi.fn());
const afterTasks = vi.hoisted(() => [] as (() => unknown)[]);
const sync = vi.hoisted(() => vi.fn(async () => "off" as const));

vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => afterTasks.push(task) }));
vi.mock("@/lib/mailerlite/on-change", () => ({ syncMembersToMailerLite: sync }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    return {
      auth: {
        getClaims: async () =>
          db.signedIn
            ? {
                data: { claims: { sub: MEMBER_ID, email: "jordan.ellis@example.com" } },
                error: null,
              }
            : { data: null, error: null },
      },
      from: (table: string) => {
        expect(table).toBe("profiles");
        const query: Query = { op: "select", filters: {} };
        db.queries.push(query);
        const builder = {
          select: (columns: string) => {
            if (query.op === "select") query.columns = columns;
            return query.op === "update"
              ? Promise.resolve({ data: db.updateError ? null : db.updated, error: db.updateError })
              : builder;
          },
          update: (values: object) => {
            Object.assign(query, { op: "update", values });
            return builder;
          },
          eq: (column: string, value: unknown) => {
            query.filters = { ...query.filters, [column]: value };
            return builder;
          },
          maybeSingle: async () => {
            if (db.throws) throw new Error("fetch failed");
            return { data: db.profile, error: db.readError };
          },
        };
        return builder;
      },
    };
  },
}));

const { saveProfile } = await import("./profile-actions");

const IDLE: ProfileState = { status: "idle" };

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

const JORDAN = { firstName: "Jordan", lastName: "Ellis", phone: "(479) 555-0102" };

let consoleError: MockInstance;

beforeEach(() => {
  Object.assign(db, {
    signedIn: true,
    profile: { first_name: "Jordan", last_name: "Ellis" },
    readError: null,
    updated: [{ id: MEMBER_ID }],
    updateError: null,
    throws: false,
    queries: [],
  });
  refresh.mockClear();
  sync.mockClear();
  afterTasks.length = 0;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("saveProfile", () => {
  it("sends a visitor to sign in, and touches nothing", async () => {
    db.signedIn = false;
    await expect(saveProfile(IDLE, form(JORDAN))).rejects.toThrow(
      "NEXT_REDIRECT /sign-in?next=%2Faccount",
    );
    expect(db.queries).toEqual([]);
  });

  it("saves the member's own tidied name and phone, and nothing else", async () => {
    const state = await saveProfile(
      IDLE,
      form({ firstName: " Jordan ", lastName: "Ellis-Hart", phone: " 479 555 0102 " }),
    );

    expect(state).toEqual({
      status: "saved",
      values: { firstName: "Jordan", lastName: "Ellis-Hart", phone: "479 555 0102" },
    });
    expect(db.queries).toEqual([
      { op: "select", columns: "first_name, last_name", filters: { id: MEMBER_ID } },
      {
        op: "update",
        values: { first_name: "Jordan", last_name: "Ellis-Hart", phone: "479 555 0102" },
        filters: { id: MEMBER_ID },
      },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("ignores anything else a request sends, such as a level", async () => {
    await saveProfile(IDLE, form({ ...JORDAN, level: "sponsor", expires_at: "2099-01-01" }));
    const update = db.queries.find((query) => query.op === "update");
    expect(Object.keys(update?.values ?? {})).toEqual(["first_name", "last_name", "phone"]);
  });

  it("clears a blank last name and phone", async () => {
    const state = await saveProfile(IDLE, form({ firstName: "Jordan", lastName: " ", phone: "" }));
    expect(db.queries[1].values).toEqual({ first_name: "Jordan", last_name: null, phone: null });
    expect(state).toEqual({
      status: "saved",
      values: { firstName: "Jordan", lastName: "", phone: "" },
    });
  });

  it("syncs MailerLite after a new name, once the answer has gone", async () => {
    await saveProfile(IDLE, form({ ...JORDAN, lastName: "Ellis-Hart" }));
    expect(sync).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]();
    expect(sync).toHaveBeenCalledWith([MEMBER_ID]);
  });

  it("leaves MailerLite alone when only the phone changed", async () => {
    const state = await saveProfile(IDLE, form({ ...JORDAN, phone: "479-555-0199" }));
    expect(state.status).toBe("saved");
    expect(afterTasks).toEqual([]);
  });

  it("keeps what was typed and says what's wrong, without saving", async () => {
    const sent = { firstName: "  ", lastName: "Ellis", phone: "call me" };
    expect(await saveProfile(IDLE, form(sent))).toEqual({
      status: "error",
      field: "firstName",
      message: PROFILE_MESSAGES.firstNameMissing,
      values: sent,
    });
    expect(await saveProfile(IDLE, form({ ...sent, firstName: "Jordan" }))).toMatchObject({
      field: "phone",
      message: PROFILE_MESSAGES.phoneInvalid,
    });
    expect(db.queries).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["the profile can't be read", { readError: { code: "08006", message: "down" } }],
    ["there's no profile to save", { profile: null }],
    ["the update fails", { updateError: { code: "42501", message: "permission denied" } }],
    ["the update changes no row", { updated: [] }],
    ["Supabase can't be reached", { throws: true }],
  ])("says the details couldn't be saved when %s", async (_case, failure) => {
    Object.assign(db, failure);
    expect(await saveProfile(IDLE, form({ ...JORDAN, firstName: "Jo" }))).toEqual({
      status: "error",
      field: null,
      message: PROFILE_MESSAGES.unavailable,
      values: { ...JORDAN, firstName: "Jo" },
    });
    expect(consoleError).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(afterTasks).toEqual([]);
  });
});
