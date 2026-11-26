// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILE_MESSAGES } from "./member-files-state";

const EDITOR_ID = "00000000-0000-4000-8100-000000000003";
const ID = "3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b";
const PATH = `${ID}/Board-minutes.pdf`;

// A stand-in for Supabase as the signed-in editor: their roles, Storage and member_files. Every
// call is recorded in `calls`.
const db = vi.hoisted(() => ({
  signedIn: true,
  roles: ["editor"] as string[],
  signUploadError: null as object | null,
  info: { size: 1234, contentType: "application/pdf" } as object | null,
  insertError: null as { code: string; message: string } | null,
  deleted: [] as object[],
  deleteError: null as { code: string; message: string } | null,
  calls: [] as unknown[][],
}));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
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
          ? { data: { claims: { sub: EDITOR_ID, email: "morgan.hale@example.com" } }, error: null }
          : { data: null, error: null },
    },
    from: (table: string) => {
      let op = "select";
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          db.calls.push([op, table, column, value]);
          return builder;
        },
        insert: async (values: object) => {
          db.calls.push(["insert", table, values]);
          return { error: db.insertError };
        },
        delete: () => {
          op = "delete";
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (table === "user_roles") {
            return Promise.resolve({ data: db.roles.map((role) => ({ role })), error: null }).then(
              resolve,
            );
          }
          return Promise.resolve({ data: db.deleted, error: db.deleteError }).then(resolve);
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

const { refresh } = await import("next/cache");
const { prepareUpload, removeMemberFile, saveUploadedFile } =
  await import("./member-files-actions");

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(db, {
    signedIn: true,
    roles: ["editor"],
    signUploadError: null,
    info: { size: 1234, contentType: "application/pdf" },
    insertError: null,
    deleted: [],
    deleteError: null,
    calls: [],
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const SAVE = {
  path: PATH,
  fileName: "Board minutes.pdf",
  title: " Board minutes ",
  audience: "levels",
  levels: ["sponsor", "band"],
};

describe("prepareUpload", () => {
  it("gives an editor a one-time upload link for a new object named after the file", async () => {
    const result = await prepareUpload({ name: "Board minutes.pdf", size: 1234 });
    expect(result.status).toBe("ready");
    const [call] = db.calls.filter(([kind]) => kind === "signUpload");
    expect(call[1]).toBe("member-files");
    expect(call[2]).toMatch(/^[0-9a-f-]{36}\/Board-minutes\.pdf$/);
    expect(result).toEqual({
      status: "ready",
      path: call[2],
      uploadUrl: `http://storage/upload/${call[2]}?token=t`,
    });
  });

  it("lets administrators upload too", async () => {
    db.roles = ["admin"];
    expect((await prepareUpload({ name: "a.pdf", size: 1 })).status).toBe("ready");
  });

  it("refuses members without the Editor or Administrator role", async () => {
    for (const roles of [[], ["moderator"], ["membership_manager"]]) {
      db.roles = roles;
      expect(await prepareUpload({ name: "a.pdf", size: 1 })).toEqual({
        status: "error",
        message: FILE_MESSAGES.notEditor,
      });
    }
    expect(db.calls.some(([kind]) => kind === "signUpload")).toBe(false);
  });

  it("refuses an empty or oversized file before asking Storage", async () => {
    expect(await prepareUpload({ name: "a.pdf", size: 0 })).toEqual({
      status: "error",
      message: FILE_MESSAGES.fileEmpty,
    });
    expect(await prepareUpload({ name: "a.pdf", size: 51 * 1024 * 1024 })).toEqual({
      status: "error",
      message: FILE_MESSAGES.fileTooBig,
    });
    expect(db.calls).toEqual([]);
  });

  it("sends visitors to sign in", async () => {
    db.signedIn = false;
    await expect(prepareUpload({ name: "a.pdf", size: 1 })).rejects.toThrow(
      "redirect /sign-in?next=%2Fadmin%2Ffiles",
    );
  });

  it("reports Storage refusing the link", async () => {
    db.signUploadError = { message: "new row violates row-level security policy" };
    expect(await prepareUpload({ name: "a.pdf", size: 1 })).toEqual({
      status: "error",
      message: FILE_MESSAGES.unavailable,
    });
  });
});

describe("saveUploadedFile", () => {
  it("adds the row for an uploaded file, with Storage's size and type", async () => {
    const result = await saveUploadedFile(SAVE);
    expect(result).toEqual({
      status: "saved",
      id: ID,
      message: 'Added "Board minutes". Copy its code into the Studio.',
    });
    expect(db.calls).toContainEqual([
      "insert",
      "member_files",
      {
        id: ID,
        title: "Board minutes",
        object_path: PATH,
        file_name: "Board minutes.pdf",
        content_type: "application/pdf",
        size_bytes: 1234,
        audience: "levels",
        levels: ["band", "sponsor"],
      },
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("doesn't add a row for a file Storage doesn't have", async () => {
    db.info = null;
    expect(await saveUploadedFile(SAVE)).toEqual({
      status: "error",
      message: FILE_MESSAGES.notUploaded,
    });
    expect(db.calls.some(([kind]) => kind === "insert")).toBe(false);
  });

  it("removes the uploaded file again if its row can't be added", async () => {
    db.insertError = { code: "42501", message: "new row violates row-level security policy" };
    expect(await saveUploadedFile(SAVE)).toEqual({
      status: "error",
      message: FILE_MESSAGES.unavailable,
    });
    expect(db.calls).toContainEqual(["remove", "member-files", [PATH]]);
  });

  it("checks the name, who can download it and the path the browser sends back", async () => {
    expect(await saveUploadedFile({ ...SAVE, title: " " })).toEqual({
      status: "error",
      message: FILE_MESSAGES.titleMissing,
    });
    expect(await saveUploadedFile({ ...SAVE, levels: [] })).toEqual({
      status: "error",
      message: FILE_MESSAGES.levelsMissing,
    });
    for (const path of ["elsewhere/a.pdf", `${ID}/../../x`, `${ID}/a b.pdf`]) {
      expect(await saveUploadedFile({ ...SAVE, path })).toEqual({
        status: "error",
        message: FILE_MESSAGES.unavailable,
      });
    }
    expect(db.calls.some(([kind]) => kind === "insert" || kind === "info")).toBe(false);
  });

  it("refuses members without the Editor or Administrator role", async () => {
    db.roles = ["moderator"];
    expect(await saveUploadedFile(SAVE)).toEqual({
      status: "error",
      message: FILE_MESSAGES.notEditor,
    });
  });
});

describe("removeMemberFile", () => {
  const form = (id: string) => {
    const data = new FormData();
    data.set("id", id);
    return data;
  };

  it("removes the row first, then the file", async () => {
    db.deleted = [{ title: "Board minutes", object_path: PATH }];
    expect(await removeMemberFile({ status: "idle" }, form(ID))).toEqual({
      status: "removed",
      message: 'Removed "Board minutes".',
    });
    const order = db.calls.map(([kind]) => kind).filter((kind) => kind !== "select");
    expect(order).toEqual(["delete", "remove"]);
    expect(db.calls).toContainEqual(["delete", "member_files", "id", ID]);
    expect(db.calls).toContainEqual(["remove", "member-files", [PATH]]);
  });

  it("says so when the file was already removed", async () => {
    expect(await removeMemberFile({ status: "idle" }, form(ID))).toEqual({
      status: "removed",
      message: "That file was already removed.",
    });
    expect(db.calls.some(([kind]) => kind === "remove")).toBe(false);
  });

  it("ignores a made-up id and refuses members without the role", async () => {
    expect(await removeMemberFile({ status: "idle" }, form("nope"))).toEqual({
      status: "error",
      message: FILE_MESSAGES.unavailable,
    });
    db.roles = [];
    expect(await removeMemberFile({ status: "idle" }, form(ID))).toEqual({
      status: "error",
      message: FILE_MESSAGES.notEditor,
    });
    expect(db.calls.some(([kind]) => kind === "delete" || kind === "remove")).toBe(false);
  });
});
