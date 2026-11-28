// @vitest-environment node
// The email switches' Server Function against a stand-in for MailerLite's API
// (lib/mailerlite/fake-api.ts), which takes the place of fetch, and a stand-in for the database row
// the member group sync keeps (mailerlite_subscribers).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAKE_API_KEY, fakeMailerLite, type FakeMailerLite } from "@/lib/mailerlite/fake-api";
import { EMAIL_CHOICES_MESSAGES, type EmailChoicesFormState } from "./email-choices-state";

const MEMBER = { id: "00000000-0000-4000-8100-000000000002", email: "jordan.ellis@example.com" };

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
  env: { MAILERLITE_API_KEY: undefined as string | undefined },
  // The member's mailerlite_subscribers row, or an error reading it.
  row: null as { subscriber_id: string | null } | null,
  rowError: null as { code: string; message: string } | null,
  profileIds: [] as unknown[],
}));

vi.mock("@/lib/auth/user", () => ({
  requireUser: async (returnTo: string) => {
    if (!mocks.user) throw new Error(`NEXT_REDIRECT /sign-in?next=${returnTo}`);
    return mocks.user;
  },
}));
vi.mock("@/lib/env/server", () => ({ serverEnv: () => ({ ...mocks.env }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      expect(table).toBe("mailerlite_subscribers");
      return {
        select: (columns: string) => {
          expect(columns).toBe("subscriber_id");
          return {
            eq: (column: string, value: unknown) => {
              expect(column).toBe("profile_id");
              mocks.profileIds.push(value);
              return {
                maybeSingle: async () => ({ data: mocks.row, error: mocks.rowError }),
              };
            },
          };
        },
      };
    },
  }),
}));

const { saveEmailChoicesAction } = await import("./email-choices-actions");

const IDLE: EmailChoicesFormState = { status: "idle" };

function form(...on: ("newsletter" | "events")[]): FormData {
  const data = new FormData();
  for (const name of on) data.set(name, "on");
  return data;
}

/** The names of the groups a subscriber is in, sorted. */
const groupsOf = (api: FakeMailerLite, email: string) =>
  [...(api.subscriber(email)?.groups ?? [])].map((id) => api.groups.get(id)).sort();

let api: FakeMailerLite;

beforeEach(() => {
  api = fakeMailerLite({ doubleOptIn: true });
  vi.stubGlobal("fetch", api.fetch);
  Object.assign(mocks, { user: MEMBER, row: null, rowError: null, profileIds: [] });
  mocks.env.MAILERLITE_API_KEY = FAKE_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveEmailChoicesAction", () => {
  it("sends a visitor to sign in", async () => {
    mocks.user = null;
    await expect(saveEmailChoicesAction(IDLE, form("newsletter"))).rejects.toThrow(
      "NEXT_REDIRECT /sign-in?next=/account",
    );
    expect(api.requests).toEqual([]);
  });

  it("saves the signed-in member's own choices in MailerLite", async () => {
    expect(await saveEmailChoicesAction(IDLE, form("events"))).toEqual({
      status: "saved",
      choices: { newsletter: false, events: true },
      paused: false,
    });

    expect(mocks.profileIds).toEqual([MEMBER.id]);
    expect(api.subscriber(MEMBER.email)?.status).toBe("active");
    expect(groupsOf(api, MEMBER.email)).toEqual(["Event announcements"]);
  });

  it("changes the subscriber the member group sync recorded, whatever its address", async () => {
    const jordan = api.addSubscriber("jordan@example.org", "active", ["Newsletter"]);
    mocks.row = { subscriber_id: jordan.id };

    await saveEmailChoicesAction(IDLE, form());

    expect(groupsOf(api, "jordan@example.org")).toEqual([]);
    expect(api.subscriber(MEMBER.email)).toBeUndefined();
  });

  it("finds the member by address when the record can't be read", async () => {
    api.addSubscriber(MEMBER.email, "active", ["Newsletter", "Event announcements"]);
    mocks.rowError = { code: "PGRST301", message: "JWT expired" };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await saveEmailChoicesAction(IDLE, form("newsletter"))).toMatchObject({
      status: "saved",
      choices: { newsletter: true, events: false },
    });

    expect(groupsOf(api, MEMBER.email)).toEqual(["Newsletter"]);
    expect(error).toHaveBeenCalledOnce();
    expect(JSON.stringify(error.mock.calls)).not.toContain("jordan");
  });

  it("says it couldn't, keeps what was chosen, and logs no address, when MailerLite fails", async () => {
    api.fail((r) => r.method === "POST" && r.path === "subscribers", 503);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const previous: EmailChoicesFormState = {
      status: "saved",
      choices: { newsletter: false, events: false },
      paused: true,
    };

    expect(await saveEmailChoicesAction(previous, form("newsletter", "events"))).toEqual({
      status: "error",
      message: EMAIL_CHOICES_MESSAGES.unavailable,
      choices: { newsletter: true, events: true },
      paused: true,
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("jordan");
  });

  it("says it couldn't while MailerLite isn't connected, or the member has no address", async () => {
    mocks.env.MAILERLITE_API_KEY = undefined;
    expect(await saveEmailChoicesAction(IDLE, form("newsletter"))).toMatchObject({
      status: "error",
      message: EMAIL_CHOICES_MESSAGES.unavailable,
    });

    mocks.env.MAILERLITE_API_KEY = FAKE_API_KEY;
    mocks.user = { id: MEMBER.id, email: null };
    expect(await saveEmailChoicesAction(IDLE, form("newsletter"))).toMatchObject({
      status: "error",
      message: EMAIL_CHOICES_MESSAGES.unavailable,
    });
    expect(api.requests).toEqual([]);
  });
});
