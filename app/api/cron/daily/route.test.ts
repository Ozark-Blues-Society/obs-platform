// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyJobsSummary } from "@/lib/jobs/daily";

// Stand-ins for the jobs and what they're given. lib/jobs/daily.test.ts tests the jobs themselves.
const jobs = vi.hoisted(() => ({ runDailyJobs: vi.fn() }));
vi.mock("@/lib/jobs/daily", () => jobs);

const store = vi.hoisted(() => ({ store: { kind: "membership store" } }));
vi.mock("@/lib/jobs/membership-store", () => ({
  createMembershipStore: vi.fn(() => store.store),
}));

const admin = vi.hoisted(() => ({ client: { kind: "service role client" } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => admin.client) }));

const email = vi.hoisted(() => ({ send: vi.fn(), getEmailSender: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ getEmailSender: email.getEmailSender }));

const { POST } = await import("./route");
const { createMembershipStore } = await import("@/lib/jobs/membership-store");

const SECRET = "a-long-random-cron-secret";

const SUMMARY: DailyJobsSummary = {
  ranAt: "2026-11-26T13:00:00.000Z",
  statuses: { active: 0, expiring: 1, lapsed: 1 },
  emails: {
    sent: { renewal_reminder: 1, renewal_last_reminder: 0, membership_lapsed: 1 },
    failed: 0,
    claimedElsewhere: 0,
    deferred: 0,
  },
  errors: [],
};

function cronRequest(authorization?: string): Request {
  return new Request("https://ozarkblues.example/api/cron/daily", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("POST /api/cron/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("SITE_URL", "https://ozarkblues.example/");
    email.getEmailSender.mockReturnValue(email.send);
    jobs.runDailyJobs.mockResolvedValue(SUMMARY);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("runs the daily jobs for a request with the secret and answers with the summary", async () => {
    const before = Date.now();

    const response = await POST(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
    expect(createMembershipStore).toHaveBeenCalledExactlyOnceWith(admin.client);
    expect(jobs.runDailyJobs).toHaveBeenCalledOnce();
    const [options] = jobs.runDailyJobs.mock.calls[0];
    expect(options).toMatchObject({
      store: store.store,
      send: email.send,
      siteUrl: "https://ozarkblues.example",
    });
    const now = (options.now as Date).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
    // Netlify gives the scheduled function 30 seconds in all.
    expect(options.deadline - now).toBe(20_000);
    expect(console.info).toHaveBeenCalledWith(`The daily jobs ran: ${JSON.stringify(SUMMARY)}`);
  });

  it.each([
    ["no Authorization header", undefined],
    ["a wrong secret", "Bearer not-the-secret"],
    ["the secret without Bearer", SECRET],
    ["the secret with more after it", `Bearer ${SECRET}x`],
    ["the secret's start only", `Bearer ${SECRET.slice(0, 10)}`],
    ["another scheme", `Basic ${SECRET}`],
  ])("refuses a request with %s and runs nothing", async (_case, authorization) => {
    const response = await POST(cronRequest(authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(jobs.runDailyJobs).not.toHaveBeenCalled();
  });

  it("is off, whatever the request says, while CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(cronRequest("Bearer "));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "The daily jobs are off: CRON_SECRET isn't set.",
    });
    expect(jobs.runDailyJobs).not.toHaveBeenCalled();
  });

  it("answers 500 with the summary when something in the run failed", async () => {
    const failed = { ...SUMMARY, errors: ["Updating the membership statuses failed: timeout"] };
    jobs.runDailyJobs.mockResolvedValue(failed);

    const response = await POST(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual(failed);
    expect(console.error).toHaveBeenCalledWith(
      `The daily jobs ran with errors: ${JSON.stringify(failed)}`,
    );
  });

  it.each([
    ["missing", undefined],
    ["not an address", "ozarkblues.example"],
    ["not a web address", "ftp://ozarkblues.example"],
  ])("doesn't start when SITE_URL is %s", async (_case, siteUrl) => {
    vi.stubEnv("SITE_URL", siteUrl);

    const response = await POST(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "The daily jobs couldn't start: SITE_URL must be the site's address, such as https://<Society domain>.",
    });
    expect(jobs.runDailyJobs).not.toHaveBeenCalled();
  });

  it("doesn't start when email isn't set up", async () => {
    email.getEmailSender.mockImplementation(() => {
      throw new Error("Email isn't set up: set RESEND_API_KEY.");
    });

    const response = await POST(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The daily jobs couldn't start: Email isn't set up: set RESEND_API_KEY.",
    });
    expect(jobs.runDailyJobs).not.toHaveBeenCalled();
  });
});
