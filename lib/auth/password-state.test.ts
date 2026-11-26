// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MESSAGES,
  checkNewPassword,
  passwordUpdateProblem,
} from "./password-state";

describe("checkNewPassword", () => {
  it("accepts a password typed the same way twice, exactly as typed", () => {
    expect(checkNewPassword(" blue notes ", " blue notes ")).toEqual({
      ok: true,
      password: " blue notes ",
    });
  });

  it.each([
    ["no password", null, null, "password", PASSWORD_MESSAGES.missing],
    ["an empty password", "", "", "password", PASSWORD_MESSAGES.missing],
    ["7 characters", "1234567", "1234567", "password", PASSWORD_MESSAGES.tooShort],
    // Four emoji are 16 bytes but only 4 characters, and Supabase counts characters.
    ["4 emoji", "🎸🎺🎷🥁", "🎸🎺🎷🥁", "password", PASSWORD_MESSAGES.tooShort],
    ["73 characters", "a".repeat(73), "a".repeat(73), "password", PASSWORD_MESSAGES.tooLong],
    // 19 emoji are 76 bytes, over the 72-byte limit, although only 19 characters.
    ["19 emoji", "🎸".repeat(19), "🎸".repeat(19), "password", PASSWORD_MESSAGES.tooLong],
    ["no confirmation", "blue notes", null, "confirm", PASSWORD_MESSAGES.confirmMissing],
    ["an empty confirmation", "blue notes", "", "confirm", PASSWORD_MESSAGES.confirmMissing],
    ["two different passwords", "blue notes", "blue nites", "confirm", PASSWORD_MESSAGES.mismatch],
  ])("refuses %s", (_case, password, confirm, field, message) => {
    expect(checkNewPassword(password, confirm)).toEqual({ ok: false, field, message });
  });

  it("accepts the shortest and the longest password Supabase takes", () => {
    const shortest = "a".repeat(MIN_PASSWORD_LENGTH);
    const longest = "a".repeat(72);
    expect(checkNewPassword(shortest, shortest)).toMatchObject({ ok: true });
    expect(checkNewPassword(longest, longest)).toMatchObject({ ok: true });
  });

  it("refuses a file instead of text", () => {
    const file = new File(["blue notes"], "password.txt");
    expect(checkNewPassword(file, file)).toMatchObject({ ok: false, field: "password" });
  });
});

describe("passwordUpdateProblem", () => {
  it.each([
    ["weak_password", PASSWORD_MESSAGES.weak],
    ["same_password", PASSWORD_MESSAGES.samePassword],
    ["reauthentication_needed", PASSWORD_MESSAGES.signInAgain],
    // Supabase Auth's codes when "Require current password when updating" is on.
    ["current_password_required", PASSWORD_MESSAGES.signInWithLink],
    ["current_password_invalid", PASSWORD_MESSAGES.signInWithLink],
    ["over_request_rate_limit", PASSWORD_MESSAGES.tooManyAttempts],
    ["unexpected_failure", PASSWORD_MESSAGES.unavailable],
    [undefined, PASSWORD_MESSAGES.unavailable],
  ])("explains %s on the new password field", (code, message) => {
    expect(passwordUpdateProblem({ code })).toEqual({ field: "password", message });
  });
});

it("asks for the same minimum length as Supabase Auth (supabase/config.jsonc)", () => {
  const config = readFileSync(new URL("../../supabase/config.jsonc", import.meta.url), "utf8");
  const setting = /"minimum_password_length":\s*(\d+)/.exec(config);
  expect(setting, "auth.minimum_password_length in supabase/config.jsonc").not.toBeNull();
  expect(Number(setting?.[1])).toBe(MIN_PASSWORD_LENGTH);
  expect(PASSWORD_MESSAGES.hint).toContain(`${MIN_PASSWORD_LENGTH} characters`);
});
