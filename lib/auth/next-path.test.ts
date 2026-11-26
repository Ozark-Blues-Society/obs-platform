import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each([
    ["/account", "/account"],
    ["/events/members-night", "/events/members-night"],
    ["/blog?category=news#latest", "/blog?category=news#latest"],
    ["/", "/"],
  ])("keeps the on-site path %s", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it.each([
    ["missing", null],
    ["not a string", ["/account"]],
    ["empty", ""],
    ["a relative path", "account"],
    ["a full URL", "https://elsewhere.example/account"],
    ["a protocol-relative URL", "//elsewhere.example/account"],
    ["a dot segment that normalizes to //evil.com", "/.//evil.com"],
    ["an encoded dot segment that normalizes to //evil.com", "/%2e//evil.com"],
    ["a climb that normalizes to //evil.com", "/x/..//evil.com"],
    ["a backslash trick", "/\\elsewhere.example"],
    ["an encoded-free backslash later on", "/account\\..\\x"],
    ["a control character", "/account\n"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["the sign-in page", "/sign-in"],
    ["the sign-in page with a query", "/sign-in?next=/account"],
    ["the email-link route", "/auth/confirm?token_hash=x&type=email"],
  ])("falls back to My Account for %s", (_case, value) => {
    expect(safeNextPath(value)).toBe(DEFAULT_AFTER_SIGN_IN);
  });

  it("normalizes dot segments that try to climb out", () => {
    expect(safeNextPath("/../../account")).toBe("/account");
  });
});
