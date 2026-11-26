// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stand-ins for the sync and what it's given. lib/mailerlite/sync.test.ts tests the sync itself.
const sync = vi.hoisted(() => ({ syncMailerLite: vi.fn() }));
vi.mock("./sync", () => sync);

const store = vi.hoisted(() => ({ store: { kind: "MailerLite store" } }));
vi.mock("./store", () => ({ createMailerLiteStore: vi.fn(() => store.store) }));

const admin = vi.hoisted(() => ({
  client: { kind: "service role client" },
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin.createAdminClient }));

const { syncMembersToMailerLite } = await import("./on-change");
const { createMailerLiteStore } = await import("./store");

const SUMMARY = { synced: 1, removed: 0, claimedElsewhere: 0, deferred: 0, failed: 0, errors: [] };

describe("syncMembersToMailerLite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    admin.createAdminClient.mockReturnValue(admin.client);
    sync.syncMailerLite.mockResolvedValue(SUMMARY);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does nothing while the sync is off", async () => {
    vi.stubEnv("MAILERLITE_API_KEY", "");

    expect(await syncMembersToMailerLite(["profile-ada"])).toBe("off");
    expect(sync.syncMailerLite).not.toHaveBeenCalled();
  });

  it("syncs only the members it's given, for at most 10 seconds", async () => {
    vi.stubEnv("MAILERLITE_API_KEY", "test-api-key");
    const before = Date.now();

    expect(await syncMembersToMailerLite(["profile-ada"])).toEqual(SUMMARY);

    expect(createMailerLiteStore).toHaveBeenCalledExactlyOnceWith(admin.client);
    const [options] = sync.syncMailerLite.mock.calls[0];
    expect(options).toMatchObject({ store: store.store, profileIds: ["profile-ada"] });
    expect(options.client).toBeDefined();
    expect(options.deadline).toBeGreaterThanOrEqual(before + 10_000);
    expect(options.deadline).toBeLessThanOrEqual(Date.now() + 10_000);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs what failed, and never throws", async () => {
    vi.stubEnv("MAILERLITE_API_KEY", "test-api-key");
    const failed = {
      ...SUMMARY,
      synced: 0,
      failed: 1,
      errors: ["MailerLite sync: syncing profile profile-ada failed: (details)"],
    };
    sync.syncMailerLite.mockResolvedValueOnce(failed);

    expect(await syncMembersToMailerLite(["profile-ada"])).toEqual(failed);
    expect(console.error).toHaveBeenCalledOnce();

    admin.createAdminClient.mockImplementationOnce(() => {
      throw new Error("The service role isn't configured.");
    });
    expect(await syncMembersToMailerLite(["profile-ada", "profile-bo"])).toEqual({
      synced: 0,
      removed: 0,
      claimedElsewhere: 0,
      deferred: 0,
      failed: 2,
      errors: ["MailerLite sync: couldn't start: The service role isn't configured."],
    });
  });
});
