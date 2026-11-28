// @vitest-environment node
// The blog's newsletter signup against a stand-in for MailerLite's API (lib/mailerlite/fake-api.ts),
// which takes the place of fetch: nothing reaches MailerLite.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAKE_API_KEY, fakeMailerLite, type FakeMailerLite } from "@/lib/mailerlite/fake-api";
import { SIGNUP_MESSAGES, type SignupState } from "./signup-state";

const env = vi.hoisted(() => ({ MAILERLITE_API_KEY: undefined as string | undefined }));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ ...env }) }));

const { signUpForNewsletter } = await import("./signup-actions");

const IDLE: SignupState = { status: "idle" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

let api: FakeMailerLite;

beforeEach(() => {
  api = fakeMailerLite({ doubleOptIn: true });
  vi.stubGlobal("fetch", api.fetch);
  env.MAILERLITE_API_KEY = FAKE_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("signUpForNewsletter", () => {
  it("adds the address to the Newsletter group, and MailerLite asks it to confirm", async () => {
    const state = await signUpForNewsletter(IDLE, form({ email: " Ada.Quinn@Example.com " }));

    expect(state).toEqual({ status: "done" });
    expect(api.membersOf("Newsletter")).toEqual(["ada.quinn@example.com"]);
    expect(api.confirmationEmails).toEqual(["ada.quinn@example.com"]);
  });

  it.each([
    ["", SIGNUP_MESSAGES.emailMissing],
    ["ada.quinn", SIGNUP_MESSAGES.emailInvalid],
    ["ada quinn@example.com", SIGNUP_MESSAGES.emailInvalid],
  ])("says what's wrong with %j, and sends MailerLite nothing", async (email, message) => {
    expect(await signUpForNewsletter(IDLE, form({ email }))).toEqual({
      status: "error",
      field: "email",
      message,
      email: email.trim().toLowerCase(),
    });
    expect(api.requests).toEqual([]);
  });

  it("tells a bot that filled the trap field it's done, and sends MailerLite nothing", async () => {
    const state = await signUpForNewsletter(
      IDLE,
      form({ email: "bot@example.com", website: "https://spam.example" }),
    );

    expect(state).toEqual({ status: "done" });
    expect(api.requests).toEqual([]);
  });

  it("says the same to someone who unsubscribed, changes nothing, and logs no address", async () => {
    api.addSubscriber("ada.quinn@example.com", "unsubscribed");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await signUpForNewsletter(IDLE, form({ email: "ada.quinn@example.com" }))).toEqual({
      status: "done",
    });

    expect(api.subscriber("ada.quinn@example.com")?.status).toBe("unsubscribed");
    expect(api.membersOf("Newsletter")).toEqual([]);
    expect(info).toHaveBeenCalledOnce();
    expect(JSON.stringify(info.mock.calls)).not.toContain("ada.quinn");
  });

  it("says it couldn't, and logs no address, when MailerLite fails", async () => {
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 500);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await signUpForNewsletter(IDLE, form({ email: "ada.quinn@example.com" }))).toEqual({
      status: "error",
      field: null,
      message: SIGNUP_MESSAGES.unavailable,
      email: "ada.quinn@example.com",
    });
    expect(error).toHaveBeenCalledOnce();
    expect(JSON.stringify(error.mock.calls)).not.toContain("ada.quinn");
  });

  it("says it couldn't while MailerLite isn't connected", async () => {
    env.MAILERLITE_API_KEY = undefined;

    expect(await signUpForNewsletter(IDLE, form({ email: "ada.quinn@example.com" }))).toEqual({
      status: "error",
      field: null,
      message: SIGNUP_MESSAGES.unavailable,
      email: "ada.quinn@example.com",
    });
    expect(api.requests).toEqual([]);
  });
});
