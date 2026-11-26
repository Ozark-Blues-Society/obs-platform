// @vitest-environment node
// Netlify's scheduled function, netlify/functions/daily-jobs.mts. Its tests live here because every
// file in netlify/functions becomes a function.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dailyJobs, { config } from "@/netlify/functions/daily-jobs.mts";
import { SOCIETY_TIME_ZONE } from "@/sanity/schemas/options";

const CONTEXT = { site: { url: "https://ozarkblues.example" } };
const SUMMARY = '{"ranAt":"2026-11-26T13:00:00.000Z"}';

/** Netlify passes the scheduled function a request whose body says when it runs next. */
const scheduledRequest = () =>
  new Request("https://ozarkblues.example/.netlify/functions/daily-jobs", {
    method: "POST",
    body: JSON.stringify({ next_run: "2026-11-27T13:00:00.000Z" }),
  });

describe("the daily jobs' scheduled function", () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(SUMMARY, { status: 200 }));

  beforeEach(() => {
    fetch.mockClear();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("CRON_SECRET", "a-long-random-cron-secret");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("runs every day at 13:00 UTC: 7 AM in the Ozarks in winter, 8 AM in summer", () => {
    expect(config).toEqual({ schedule: "0 13 * * *" });
    const ozarksTime = (date: string) =>
      new Intl.DateTimeFormat("en-US", { timeZone: SOCIETY_TIME_ZONE, timeStyle: "short" })
        .format(new Date(date))
        .replace(/\s/g, " ");
    expect(ozarksTime("2026-12-15T13:00:00Z")).toBe("7:00 AM");
    expect(ozarksTime("2027-06-15T13:00:00Z")).toBe("8:00 AM");
  });

  it("asks the site, at its main address, to run the daily jobs with the secret", async () => {
    await dailyJobs(scheduledRequest(), CONTEXT);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://ozarkblues.example/api/cron/daily");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer a-long-random-cron-secret",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(console.info).toHaveBeenCalledWith(`The daily jobs ran: ${SUMMARY}`);
  });

  it("fails, with the site's answer, when the run fails, so Netlify's log shows it", async () => {
    fetch.mockResolvedValueOnce(new Response('{"errors":["..."]}', { status: 500 }));

    await expect(dailyJobs(scheduledRequest(), CONTEXT)).rejects.toThrow(
      'The daily jobs failed (HTTP 500): {"errors":["..."]}',
    );
  });

  it("does nothing while CRON_SECRET isn't set: the daily jobs are off", async () => {
    vi.stubEnv("CRON_SECRET", "");

    await dailyJobs(scheduledRequest(), CONTEXT);

    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("The daily jobs are off: CRON_SECRET isn't set.");
  });

  it("fails when Netlify doesn't give the site's address", async () => {
    await expect(dailyJobs(scheduledRequest(), { site: {} })).rejects.toThrow(
      "Netlify didn't say the site's address",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
