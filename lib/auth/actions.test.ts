// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// A stand-in for Supabase: signInWithOtp() answers with `otpError`.
const supabase = vi.hoisted(() => ({
  otpError: null as { code: string; message: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOtp: async () => ({
        data: { user: null, session: null },
        error: supabase.otpError,
      }),
    },
  }),
}));

const { sendSignInLink } = await import("./actions");

const EMAIL = "casey.brooks@example.com";

function emailForm(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("sendSignInLink", () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    supabase.otpError = null;
  });

  it("says the link was sent, and logs nothing, when Supabase sends it", async () => {
    await expect(sendSignInLink({ status: "idle" }, emailForm(EMAIL))).resolves.toEqual({
      status: "sent",
      email: EMAIL,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["the project's hourly email cap", "email rate limit exceeded"],
    [
      "a repeat request for the same address",
      "For security purposes, you can only request this after 42 seconds.",
    ],
  ])("still says sent, but logs a warning, for %s", async (_case, message) => {
    supabase.otpError = { code: "over_email_send_rate_limit", message };

    await expect(sendSignInLink({ status: "idle" }, emailForm(EMAIL))).resolves.toEqual({
      status: "sent",
      email: EMAIL,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.any(String), "over_email_send_rate_limit", message);
    // Server logs aren't the place for members' addresses.
    expect(JSON.stringify(warn.mock.calls)).not.toContain(EMAIL);
  });

  it("logs nothing for an address that isn't a member's", async () => {
    supabase.otpError = { code: "otp_disabled", message: "Signups not allowed for otp" };

    await expect(sendSignInLink({ status: "idle" }, emailForm(EMAIL))).resolves.toEqual({
      status: "sent",
      email: EMAIL,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
