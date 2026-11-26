// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/auth/roles";
import {
  LAST_ADMIN_ERROR,
  ROLE_MESSAGES,
  grantProblem,
  parseRemoval,
  personName,
  removalValue,
  revokeProblem,
} from "./roles-state";

const PROFILE_ID = "00000000-0000-4000-8100-000000000017";

function migration(name: string): string {
  return readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

describe("the database and the app agree", () => {
  it("on the staff roles", () => {
    const sql = migration("20261126050904_profiles_and_roles.sql");
    const values = /create type public\.app_role as enum \(([^)]*)\)/.exec(sql)?.[1];
    expect(values?.match(/'[^']+'/g)?.map((value) => value.slice(1, -1))).toEqual([...ROLES]);
  });

  it("on the error code for removing the last administrator", () => {
    const sql = migration("20261126071148_roles_management.sql");
    expect(sql).toContain(`errcode = '${LAST_ADMIN_ERROR}'`);
  });
});

describe("grantProblem", () => {
  it.each([
    ["23505", "Dale Ramsey already has the Moderator role."],
    ["23503", ROLE_MESSAGES.noAccount],
    ["42501", ROLE_MESSAGES.notAdmin],
    ["08006", ROLE_MESSAGES.unavailable],
    [undefined, ROLE_MESSAGES.unavailable],
  ])("explains error %s", (code, message) => {
    expect(grantProblem({ code }, "Dale Ramsey", "moderator")).toBe(message);
  });
});

describe("revokeProblem", () => {
  it.each([
    [LAST_ADMIN_ERROR, ROLE_MESSAGES.lastAdmin],
    ["42501", ROLE_MESSAGES.notAdmin],
    ["PGRST301", ROLE_MESSAGES.unavailable],
  ])("explains error %s", (code, message) => {
    expect(revokeProblem({ code })).toBe(message);
  });
});

describe("removalValue and parseRemoval", () => {
  it("round-trip every role", () => {
    for (const role of ROLES) {
      expect(parseRemoval(removalValue(PROFILE_ID, role))).toEqual({ profileId: PROFILE_ID, role });
    }
  });

  it.each([
    ["nothing", null],
    ["no role", PROFILE_ID],
    ["an unknown role", `${PROFILE_ID}:treasurer`],
    ["an id that isn't one", "1 or 1=1:admin"],
    ["extra parts", `${PROFILE_ID}:admin:editor`],
  ])("refuse %s", (_case, value) => {
    expect(parseRemoval(value)).toBeNull();
  });
});

describe("personName", () => {
  it("joins the first and last name", () => {
    expect(personName({ first_name: "Shannon", last_name: "O'Neal", email: "s@example.com" })).toBe(
      "Shannon O'Neal",
    );
  });

  it("uses whichever name there is", () => {
    expect(personName({ first_name: "Kelly", last_name: null, email: "k@example.com" })).toBe(
      "Kelly",
    );
  });

  it("falls back to the address when there's no name", () => {
    expect(personName({ first_name: null, last_name: "", email: "kelly@example.com" })).toBe(
      "kelly@example.com",
    );
  });
});
