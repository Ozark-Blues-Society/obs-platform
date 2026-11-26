import { describe, expect, it } from "vitest";
import { checkAccess } from "./access";
import { fileVisibility, isFileId, memberFilePath } from "./files";

describe("isFileId", () => {
  it("accepts a UUID as Postgres writes it, and nothing else", () => {
    expect(isFileId("00000000-0000-4000-8920-000000000001")).toBe(true);
    expect(isFileId("3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b")).toBe(true);
    for (const value of [
      "3F2B9C1E-8D4A-4E6F-9B2C-7A1D5E8F0C3B",
      "3f2b9c1e8d4a4e6f9b2c7a1d5e8f0c3b",
      "../3f2b9c1e-8d4a-4e6f-9b2c-7a1d5e8f0c3b",
      "",
      null,
      42,
    ]) {
      expect(isFileId(value), String(value)).toBe(false);
    }
  });
});

describe("memberFilePath", () => {
  it("is the file's download route", () => {
    expect(memberFilePath("00000000-0000-4000-8920-000000000001")).toBe(
      "/files/00000000-0000-4000-8920-000000000001",
    );
  });
});

describe("fileVisibility", () => {
  const sponsor = {
    kind: "member" as const,
    userId: "u",
    level: "sponsor" as const,
    expiresAt: "2099-01-01T00:00:00Z",
  };
  const now = new Date("2026-11-26T12:00:00Z");

  it("passes the database's audience and levels to the shared rules", () => {
    expect(fileVisibility({ audience: "members", levels: [] })).toEqual({
      audience: "members",
      levels: [],
    });
    expect(fileVisibility({ audience: "levels", levels: ["band", "sponsor"] })).toEqual({
      audience: "levels",
      levels: ["band", "sponsor"],
    });
  });

  it("never makes a file public, whatever the row says", () => {
    const visitor = { kind: "visitor" as const };
    for (const audience of ["everyone", null, undefined, 3]) {
      const visibility = fileVisibility({ audience, levels: null });
      expect(visibility.audience).toBeNull();
      expect(checkAccess(visibility, visitor, now).allowed).toBe(false);
      expect(checkAccess(visibility, sponsor, now).allowed).toBe(false);
    }
  });
});
