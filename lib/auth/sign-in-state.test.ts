import { describe, expect, it } from "vitest";
import {
  MESSAGES,
  emailLinkResult,
  looksLikeEmail,
  normalizeEmail,
  passwordErrorMessage,
} from "./sign-in-state";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Avery.Collins@Example.COM ")).toBe("avery.collins@example.com");
  });

  it("treats a missing or file value as empty", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(new File([], "x.txt"))).toBe("");
  });
});

describe("looksLikeEmail", () => {
  it.each(["avery@example.com", "a.b+club@sub.example.org"])("accepts %s", (email) => {
    expect(looksLikeEmail(email)).toBe(true);
  });

  it.each(["avery", "avery@", "@example.com", "avery@example", "a very@example.com"])(
    "rejects %s",
    (email) => {
      expect(looksLikeEmail(email)).toBe(false);
    },
  );

  it("rejects addresses longer than 254 characters", () => {
    expect(looksLikeEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("emailLinkResult", () => {
  const email = "avery@example.com";

  it("reports a sent link on success", () => {
    expect(emailLinkResult(email, null)).toEqual({ status: "sent", email });
  });

  // Telling these apart would reveal which addresses belong to members.
  it.each(["otp_disabled", "over_email_send_rate_limit"])(
    "answers %s exactly like success",
    (code) => {
      expect(emailLinkResult(email, { code, status: 422 })).toEqual({ status: "sent", email });
    },
  );

  it("asks the person to wait when their connection is rate-limited", () => {
    expect(emailLinkResult(email, { code: "over_request_rate_limit", status: 429 })).toEqual({
      status: "error",
      email,
      message: MESSAGES.tooManyAttempts,
    });
  });

  it("asks for a valid address when Supabase rejects it", () => {
    expect(emailLinkResult(email, { code: "email_address_invalid", status: 400 })).toMatchObject({
      status: "error",
      message: MESSAGES.emailInvalid,
    });
  });

  it("reports anything else as sign-in being unavailable", () => {
    expect(emailLinkResult(email, { code: "unexpected_failure", status: 500 })).toMatchObject({
      status: "error",
      message: MESSAGES.unavailable,
    });
    expect(emailLinkResult(email, { message: "fetch failed" })).toMatchObject({
      status: "error",
      message: MESSAGES.unavailable,
    });
  });
});

describe("passwordErrorMessage", () => {
  it.each([
    ["invalid_credentials", MESSAGES.wrongPassword],
    ["email_not_confirmed", MESSAGES.emailNotConfirmed],
    ["over_request_rate_limit", MESSAGES.tooManyAttempts],
    ["unexpected_failure", MESSAGES.unavailable],
    [undefined, MESSAGES.unavailable],
  ])("maps %s to the right message", (code, message) => {
    expect(passwordErrorMessage({ code })).toBe(message);
  });
});
