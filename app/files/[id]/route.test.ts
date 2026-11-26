// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/members/access";

const FILE_ID = "00000000-0000-4000-8920-000000000001";
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const member = (level: "individual" | "band" | null, expiresAt: string | null): Viewer => ({
  kind: "member",
  userId: "00000000-0000-4000-8100-000000000018",
  level,
  expiresAt,
});

// A stand-in for Supabase as the signed-in member: the member_files row row level security lets
// them see (or none), and Storage's signed links.
const db = vi.hoisted(() => ({
  configured: true,
  viewer: { kind: "visitor" } as Viewer,
  row: null as object | null,
  rowError: null as { code: string; message: string } | null,
  signed: { signedUrl: "http://127.0.0.1:54321/storage/v1/object/sign/x?token=t" } as object | null,
  signError: null as object | null,
  calls: [] as unknown[][],
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/config", () => ({
  readSupabaseConfig: () => (db.configured ? { url: "http://x", publishableKey: "k" } : null),
}));
vi.mock("@/lib/members/viewer", () => ({ getViewer: async () => db.viewer }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const builder = {
        select: (columns: string) => {
          db.calls.push(["select", table, columns]);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          db.calls.push(["eq", column, value]);
          return builder;
        },
        maybeSingle: async () => ({ data: db.row, error: db.rowError }),
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, seconds: number, options: object) => {
          db.calls.push(["sign", bucket, path, seconds, options]);
          return { data: db.signed, error: db.signError };
        },
      }),
    },
  }),
}));

const { GET } = await import("./route");

const MINUTES_ROW = {
  object_path: `${FILE_ID}/minutes.pdf`,
  file_name: "Minutes, November.pdf",
  audience: "members",
  levels: [],
};

function get(id: string): Promise<Response> {
  return GET(new Request(`http://localhost/files/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  Object.assign(db, {
    configured: true,
    viewer: { kind: "visitor" },
    row: null,
    rowError: null,
    signed: { signedUrl: "http://127.0.0.1:54321/storage/v1/object/sign/x?token=t" },
    signError: null,
    calls: [],
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
}

describe("GET /files/[id]", () => {
  it("sends a member who may download the file on to a one-minute Storage link", async () => {
    db.viewer = member("individual", inDays(30));
    db.row = MINUTES_ROW;
    const response = await get(FILE_ID);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/sign/x?token=t",
    );
    expectPrivate(response);
    expect(db.calls).toEqual([
      ["select", "member_files", "object_path, file_name, audience, levels"],
      ["eq", "id", FILE_ID],
      ["sign", "member-files", `${FILE_ID}/minutes.pdf`, 60, { download: "Minutes, November.pdf" }],
    ]);
  });

  it("sends a visitor to sign in, then back to the file", async () => {
    const response = await get(FILE_ID);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/sign-in?next=%2Ffiles%2F${FILE_ID}`);
    expectPrivate(response);
    expect(db.calls).toEqual([]);
  });

  it("asks a member whose membership has ended to renew", async () => {
    db.viewer = member("band", inDays(-1));
    const response = await get(FILE_ID);
    expect(response.status).toBe(403);
    expectPrivate(response);
    const html = await response.text();
    expect(html).toContain("<h1>Your membership has ended</h1>");
    expect(html).toContain('<a href="/join">Renew your membership</a>');
  });

  it("asks someone who never paid to join", async () => {
    db.viewer = member(null, null);
    const response = await get(FILE_ID);
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("<h1>This file is for members</h1>");
  });

  it("tells an active member when a file isn't for them, without saying whether it exists", async () => {
    db.viewer = member("individual", inDays(30));
    const response = await get(FILE_ID);
    expect(response.status).toBe(404);
    expectPrivate(response);
    expect(await response.text()).toContain("This file isn&rsquo;t available to you");
    expect(db.calls.some(([call]) => call === "sign")).toBe(false);
  });

  it("checks the row against the membership again, as pages do", async () => {
    // An editor sees every row (row level security), but downloading here follows the member
    // rules; and a mistaken row must not hand out a file either.
    db.viewer = member("individual", inDays(30));
    db.row = { ...MINUTES_ROW, audience: "levels", levels: ["band", "business"] };
    expect((await get(FILE_ID)).status).toBe(404);
    db.viewer = member("band", inDays(-3));
    db.row = MINUTES_ROW;
    expect((await get(FILE_ID)).status).toBe(403);
    db.viewer = member("band", inDays(3));
    db.row = { ...MINUTES_ROW, audience: "everyone" };
    expect((await get(FILE_ID)).status).toBe(404);
    expect(db.calls.some(([call]) => call === "sign")).toBe(false);
  });

  it("refuses an id that isn't a UUID without asking Supabase", async () => {
    for (const id of ["nope", "../etc", `${FILE_ID}x`, "00000000-0000-4000-8920-00000000000A"]) {
      db.viewer = member("band", inDays(30));
      const response = await get(id);
      expect(response.status, id).toBe(404);
      expect(await response.text()).toContain("We couldn&rsquo;t find that file");
    }
    expect(db.calls).toEqual([]);
  });

  it("says so when Storage has no file for the row", async () => {
    db.viewer = member("band", inDays(30));
    db.row = MINUTES_ROW;
    db.signed = null;
    db.signError = { message: "Object not found" };
    const response = await get(FILE_ID);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("It may have been removed");
  });

  it("fails loudly when the row can't be read", async () => {
    db.viewer = member("band", inDays(30));
    db.rowError = { code: "PGRST000", message: "connection refused" };
    await expect(get(FILE_ID)).rejects.toThrow("PGRST000 connection refused");
  });

  it("answers 503 without Supabase settings", async () => {
    db.configured = false;
    const response = await get(FILE_ID);
    expect(response.status).toBe(503);
  });

  it("answers with a page that has a language, a viewport and a heading", async () => {
    db.viewer = member(null, null);
    const html = await (await get(FILE_ID)).text();
    expect(html).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain("<title>This file is for members &middot; Ozark Blues Society</title>");
    expect(html).toContain('<a href="/account">My Account</a>');
  });
});
