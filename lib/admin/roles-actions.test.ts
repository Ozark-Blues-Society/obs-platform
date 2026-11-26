// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { LAST_ADMIN_ERROR, ROLE_MESSAGES } from "./roles-state";

const ADMIN_ID = "00000000-0000-4000-8100-000000000001";
const DALE_ID = "00000000-0000-4000-8100-000000000017";

type DbError = { code: string; message: string } | null;
type Query = {
  table: string;
  op: "select" | "insert" | "delete";
  filters: object;
  values?: object;
};

// A stand-in for Supabase. The caller is signed in as ADMIN_ID with `callerRoles`; a profile
// lookup finds `profile`; inserts and deletes answer with the errors and rows set here. Every
// query is recorded in `queries`.
const db = vi.hoisted(() => ({
  signedIn: true,
  callerRoles: [] as string[],
  profile: null as object | null,
  insertError: null as DbError,
  deleted: [] as object[],
  deleteError: null as DbError,
  queries: [] as Query[],
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        db.signedIn
          ? { data: { claims: { sub: ADMIN_ID, email: "avery.collins@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => {
      const query: Query = { table, op: "select", filters: {} };
      const answer = () => {
        db.queries.push(query);
        if (query.op === "insert") return { data: null, error: db.insertError };
        if (query.op === "delete") return { data: db.deleted, error: db.deleteError };
        if (table === "profiles") return { data: db.profile, error: null };
        return { data: db.callerRoles.map((role) => ({ role })), error: null };
      };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          query.filters = { ...query.filters, [column]: value };
          return builder;
        },
        insert: (values: object) => {
          Object.assign(query, { op: "insert", values });
          return builder;
        },
        delete: () => {
          query.op = "delete";
          return builder;
        },
        maybeSingle: async () => answer(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer()).then(resolve),
      };
      return builder;
    },
  }),
}));

const { refresh } = await import("next/cache");
const { grantRole, revokeRole } = await import("./roles-actions");

const DALE = {
  id: DALE_ID,
  first_name: "Dale",
  last_name: "Ramsey",
  email: "dale.ramsey@example.com",
};

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

const changes = () => db.queries.filter((query) => query.op !== "select");

let error: MockInstance<typeof console.error>;

beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  Object.assign(db, {
    signedIn: true,
    callerRoles: ["admin"],
    profile: DALE,
    insertError: null,
    deleted: [{ profiles: DALE }],
    deleteError: null,
    queries: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("grantRole", () => {
  it("gives the role to the account with that address", async () => {
    await expect(
      grantRole({ status: "idle" }, form({ email: " Dale.Ramsey@Example.com ", role: "editor" })),
    ).resolves.toEqual({ status: "granted", message: "Dale Ramsey now has the Editor role." });

    expect(db.queries).toContainEqual(
      expect.objectContaining({ table: "profiles", filters: { email: "dale.ramsey@example.com" } }),
    );
    expect(changes()).toEqual([
      expect.objectContaining({
        table: "user_roles",
        op: "insert",
        values: { profile_id: DALE_ID, role: "editor" },
      }),
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["no address", { email: "  ", role: "editor" }, "email", ROLE_MESSAGES.emailMissing],
    ["a mistyped address", { email: "dale@", role: "editor" }, "email", ROLE_MESSAGES.emailInvalid],
    ["no role", { email: DALE.email, role: "" }, "role", ROLE_MESSAGES.roleMissing],
    [
      "a role that doesn't exist",
      { email: DALE.email, role: "treasurer" },
      "role",
      ROLE_MESSAGES.roleMissing,
    ],
  ])("explains %s without touching the database", async (_case, fields, field, message) => {
    await expect(grantRole({ status: "idle" }, form(fields))).resolves.toMatchObject({
      status: "error",
      field,
      message,
      role: fields.role,
    });
    expect(db.queries).toEqual([]);
  });

  it("says when no account uses the address", async () => {
    db.profile = null;

    await expect(
      grantRole({ status: "idle" }, form({ email: "kelly@example.com", role: "moderator" })),
    ).resolves.toEqual({
      status: "error",
      field: "email",
      message: ROLE_MESSAGES.noAccount,
      email: "kelly@example.com",
      role: "moderator",
    });
    expect(changes()).toEqual([]);
  });

  it("refuses someone who isn't an administrator before looking anyone up", async () => {
    db.callerRoles = ["membership_manager"];

    await expect(
      grantRole({ status: "idle" }, form({ email: DALE.email, role: "admin" })),
    ).resolves.toMatchObject({ status: "error", field: null, message: ROLE_MESSAGES.notAdmin });
    expect(db.queries.map((query) => query.table)).toEqual(["user_roles"]);
    expect(changes()).toEqual([]);
  });

  it("says when the person already has the role", async () => {
    db.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };

    await expect(
      grantRole({ status: "idle" }, form({ email: DALE.email, role: "moderator" })),
    ).resolves.toMatchObject({
      field: null,
      message: "Dale Ramsey already has the Moderator role.",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected refusal, without the address", async () => {
    db.insertError = { code: "53300", message: "too many connections" };

    await expect(
      grantRole({ status: "idle" }, form({ email: DALE.email, role: "moderator" })),
    ).resolves.toMatchObject({ message: ROLE_MESSAGES.unavailable });
    expect(error).toHaveBeenCalledOnce();
    expect(JSON.stringify(error.mock.calls)).not.toContain(DALE.email);
  });

  it("sends a visitor to sign in first and changes nothing", async () => {
    db.signedIn = false;

    await expect(
      grantRole({ status: "idle" }, form({ email: DALE.email, role: "admin" })),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(";/sign-in?next=%2Fadmin%2Froles;"),
    });
    expect(db.queries).toEqual([]);
  });
});

describe("revokeRole", () => {
  const remove = (value: string) => revokeRole({ status: "idle" }, form({ remove: value }));

  it("removes the role on the button that was pressed", async () => {
    await expect(remove(`${DALE_ID}:moderator`)).resolves.toEqual({
      status: "revoked",
      message: "Dale Ramsey no longer has the Moderator role.",
    });
    expect(changes()).toEqual([
      expect.objectContaining({
        table: "user_roles",
        op: "delete",
        filters: { profile_id: DALE_ID, role: "moderator" },
      }),
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("explains that the last administrator can't be removed", async () => {
    db.deleteError = {
      code: LAST_ADMIN_ERROR,
      message: "The last administrator can't be removed.",
    };

    await expect(remove(`${ADMIN_ID}:admin`)).resolves.toEqual({
      status: "error",
      message: ROLE_MESSAGES.lastAdmin,
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("says when the role was already gone", async () => {
    db.deleted = [];

    await expect(remove(`${DALE_ID}:moderator`)).resolves.toEqual({
      status: "error",
      message: ROLE_MESSAGES.alreadyRemoved,
    });
  });

  it("refuses someone who isn't an administrator", async () => {
    db.callerRoles = ["moderator"];

    await expect(remove(`${DALE_ID}:moderator`)).resolves.toEqual({
      status: "error",
      message: ROLE_MESSAGES.notAdmin,
    });
    expect(changes()).toEqual([]);
  });

  it("ignores a made-up request", async () => {
    await expect(remove("everyone:admin")).resolves.toEqual({
      status: "error",
      message: ROLE_MESSAGES.unavailable,
    });
    expect(db.queries).toEqual([]);
  });

  it("sends a visitor to sign in first and changes nothing", async () => {
    db.signedIn = false;

    await expect(remove(`${DALE_ID}:moderator`)).rejects.toMatchObject({
      digest: expect.stringContaining(";/sign-in?next=%2Fadmin%2Froles;"),
    });
    expect(db.queries).toEqual([]);
  });
});
