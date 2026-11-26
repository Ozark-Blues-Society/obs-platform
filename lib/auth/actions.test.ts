// @vitest-environment node
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { PASSWORD_MESSAGES } from "./password-state";

// A stand-in for Supabase: signInWithOtp() answers with `otpError`, getClaims() finds a session
// when `signedIn`, and updateUser() and verifyOtp() are mocks.
const supabase = vi.hoisted(() => ({
  otpError: null as { code: string; message: string } | null,
  signedIn: true,
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOtp: async () => ({
        data: { user: null, session: null },
        error: supabase.otpError,
      }),
      getClaims: async () =>
        supabase.signedIn
          ? {
              data: { claims: { sub: "member-id", email: "hazel.monroe@example.com" } },
              error: null,
            }
          : { data: null, error: null },
      updateUser: supabase.updateUser,
      verifyOtp: supabase.verifyOtp,
    },
  }),
}));

const { confirmSignIn, sendSignInLink, setPassword } = await import("./actions");

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

describe("confirmSignIn", () => {
  // Shaped like the token hashes in the local stack's sign-in emails. Made up.
  const TOKEN_HASH = "pkce_aaae5edb8e194c16ef3d8e7db84281734180e6bae15c4d401faf5847";
  let error: MockInstance<typeof console.error>;

  function confirmForm(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      formData.set(name, value);
    }
    return formData;
  }

  /** What redirect() throws for `path`, as Next.js encodes it. */
  function redirectTo(path: string) {
    return { digest: expect.stringContaining(`;${path};`) };
  }

  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    supabase.verifyOtp.mockReset();
    supabase.verifyOtp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies the link's token hash and goes to the page that asked", async () => {
    await expect(
      confirmSignIn(confirmForm({ token_hash: TOKEN_HASH, next: "/events?month=12" })),
    ).rejects.toMatchObject(redirectTo("/events?month=12"));
    expect(supabase.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      type: "email",
      token_hash: TOKEN_HASH,
    });
  });

  it.each([
    ["there's no next", {}],
    ["next leads off the site", { next: "/.//evil.example" }],
  ])("goes to My Account when %s", async (_case, fields) => {
    await expect(
      confirmSignIn(confirmForm({ token_hash: TOKEN_HASH, ...fields })),
    ).rejects.toMatchObject(redirectTo("/account"));
  });

  it("sends a used or expired link to the sign-in page's explanation, and logs nothing", async () => {
    supabase.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", message: "Email link is invalid or has expired" },
    });

    await expect(
      confirmSignIn(confirmForm({ token_hash: TOKEN_HASH, next: "/events" })),
    ).rejects.toMatchObject(redirectTo("/sign-in?error=link-expired"));
    expect(error).not.toHaveBeenCalled();
  });

  it("doesn't ask Supabase when there's no token hash", async () => {
    await expect(confirmSignIn(confirmForm({ token_hash: "" }))).rejects.toMatchObject(
      redirectTo("/sign-in?error=link-expired"),
    );
    expect(supabase.verifyOtp).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an error that isn't about the link",
      () =>
        supabase.verifyOtp.mockResolvedValue({
          data: { user: null, session: null },
          error: { code: "unexpected_failure", message: "Database error" },
        }),
    ],
    ["a failed request", () => supabase.verifyOtp.mockRejectedValue(new TypeError("fetch failed"))],
  ])("sends the member to the explanation, and logs why, after %s", async (_case, fail) => {
    fail();

    await expect(confirmSignIn(confirmForm({ token_hash: TOKEN_HASH }))).rejects.toMatchObject(
      redirectTo("/sign-in?error=link-expired"),
    );
    expect(error).toHaveBeenCalledOnce();
    // After a passing fault the link still works, so its token hash stays out of the logs.
    expect(inspect(error.mock.calls)).not.toContain(TOKEN_HASH);
  });
});

describe("setPassword", () => {
  const NEW_PASSWORD = "delta blues forever";
  let error: MockInstance<typeof console.error>;

  function passwordForm(password: string, confirm: string): FormData {
    const formData = new FormData();
    formData.set("password", password);
    formData.set("confirm", confirm);
    return formData;
  }

  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    supabase.updateUser.mockReset();
    supabase.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    supabase.signedIn = true;
  });

  it("saves the new password for the signed-in member", async () => {
    await expect(
      setPassword({ status: "idle" }, passwordForm(NEW_PASSWORD, NEW_PASSWORD)),
    ).resolves.toEqual({ status: "saved" });
    expect(supabase.updateUser).toHaveBeenCalledExactlyOnceWith({ password: NEW_PASSWORD });
  });

  it("sends a visitor to sign in first and changes nothing", async () => {
    supabase.signedIn = false;

    await expect(
      setPassword({ status: "idle" }, passwordForm(NEW_PASSWORD, NEW_PASSWORD)),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(";/sign-in?next=%2Faccount%2Fpassword;"),
    });
    expect(supabase.updateUser).not.toHaveBeenCalled();
  });

  it("explains a typing problem without asking Supabase", async () => {
    await expect(
      setPassword({ status: "idle" }, passwordForm(NEW_PASSWORD, "delta blues for ever")),
    ).resolves.toEqual({ status: "error", field: "confirm", message: PASSWORD_MESSAGES.mismatch });
    expect(supabase.updateUser).not.toHaveBeenCalled();
  });

  it("explains a refusal that has a reason, and logs nothing", async () => {
    supabase.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "same_password", message: "New password should be different." },
    });

    await expect(
      setPassword({ status: "idle" }, passwordForm(NEW_PASSWORD, NEW_PASSWORD)),
    ).resolves.toEqual({
      status: "error",
      field: "password",
      message: PASSWORD_MESSAGES.samePassword,
    });
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an error Supabase gives no reason for",
      () =>
        supabase.updateUser.mockResolvedValue({
          data: { user: null },
          error: { code: "unexpected_failure", message: "Database error" },
        }),
    ],
    [
      "a failed request",
      () => supabase.updateUser.mockRejectedValue(new TypeError("fetch failed")),
    ],
  ])("says the password wasn't saved, and logs why, after %s", async (_case, fail) => {
    fail();

    await expect(
      setPassword({ status: "idle" }, passwordForm(NEW_PASSWORD, NEW_PASSWORD)),
    ).resolves.toEqual({
      status: "error",
      field: "password",
      message: PASSWORD_MESSAGES.unavailable,
    });
    expect(error).toHaveBeenCalledOnce();
    // Passwords never go in the server logs.
    expect(inspect(error.mock.calls)).not.toContain(NEW_PASSWORD);
  });
});
