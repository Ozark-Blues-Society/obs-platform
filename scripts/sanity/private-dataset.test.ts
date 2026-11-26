// @vitest-environment node
import { evaluate, parse } from "groq-js";
import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_QUERY,
  checkPrivateDataset,
  EXIT_CODES,
  PUBLISHED_COUNT_QUERY,
} from "./private-dataset.mts";

const OPTIONS = { projectId: "abc123", dataset: "production", apiVersion: "2026-11-26" };

type Call = { url: URL; authorization: string | undefined };

/** A stand-in for Sanity's query API: answers anonymous and token queries as given. */
function fakeSanity(answers: {
  anonymous?: unknown;
  withToken?: unknown;
  status?: number;
  body?: string;
}) {
  const calls: Call[] = [];
  const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const authorization = (init?.headers as Record<string, string> | undefined)?.authorization;
    calls.push({ url, authorization });
    const result = authorization ? answers.withToken : answers.anonymous;
    return new Response(answers.body ?? JSON.stringify({ result }), {
      status: answers.status ?? 200,
    });
  }) as typeof fetch;
  return { fetchFn, calls };
}

describe("checkPrivateDataset", () => {
  it("passes when an anonymous query finds nothing and the token finds published content", async () => {
    const { fetchFn, calls } = fakeSanity({
      anonymous: { total: 0, membersOnly: [] },
      withToken: 42,
    });
    const result = await checkPrivateDataset({ ...OPTIONS, token: "sk-test", fetch: fetchFn });
    expect(result).toEqual({
      status: "private",
      message:
        'OK: the dataset "production" of project abc123 is private. An anonymous query found none of its 42 published documents.',
    });

    const [anonymous, withToken] = calls;
    expect(anonymous.authorization).toBeUndefined();
    expect(anonymous.url.origin).toBe("https://abc123.api.sanity.io");
    expect(anonymous.url.pathname).toBe("/v2026-11-26/data/query/production");
    expect(anonymous.url.searchParams.get("query")).toBe(ANONYMOUS_QUERY);
    expect(anonymous.url.searchParams.get("perspective")).toBe("published");
    expect(withToken.authorization).toBe("Bearer sk-test");
    expect(withToken.url.searchParams.get("query")).toBe(PUBLISHED_COUNT_QUERY);
  });

  it("fails, naming members-only documents, when anyone can read the dataset", async () => {
    const { fetchFn, calls } = fakeSanity({
      anonymous: { total: 12, membersOnly: [{ _id: "post-1", _type: "post" }] },
    });
    const result = await checkPrivateDataset({ ...OPTIONS, token: "sk-test", fetch: fetchFn });
    expect(result.status).toBe("public");
    expect(result.message).toContain("FAIL: anyone can read the dataset");
    expect(result.message).toContain("12 documents, members-only ones among them (post post-1)");
    expect(result.message).toContain("sanity dataset visibility set production private");
    // No need to ask with the token once the answer is known.
    expect(calls).toHaveLength(1);
  });

  it("fails when anyone can read the dataset even if nothing in it is members-only", async () => {
    const { fetchFn } = fakeSanity({ anonymous: { total: 3, membersOnly: [] } });
    const result = await checkPrivateDataset({ ...OPTIONS, fetch: fetchFn });
    expect(result.status).toBe("public");
    expect(result.message).toContain("3 documents.");
  });

  it("can't tell without a token, or when nothing is published", async () => {
    const empty = { anonymous: { total: 0, membersOnly: [] } };
    expect(await checkPrivateDataset({ ...OPTIONS, fetch: fakeSanity(empty).fetchFn })).toEqual({
      status: "unknown",
      message: expect.stringContaining("Set SANITY_API_READ_TOKEN"),
    });
    const nothingPublished = fakeSanity({ ...empty, withToken: 0 }).fetchFn;
    expect(
      await checkPrivateDataset({ ...OPTIONS, token: "sk-test", fetch: nothingPublished }),
    ).toEqual({ status: "unknown", message: expect.stringContaining("no published documents") });
  });

  it("can't tell when Sanity errors, can't be reached or answers strangely", async () => {
    const cases: [typeof fetch, string][] = [
      [fakeSanity({ status: 404, body: '{"error":"Dataset not found"}' }).fetchFn, "answered 404"],
      [fakeSanity({ body: "<html>" }).fetchFn, "wasn't JSON"],
      [fakeSanity({ anonymous: null }).fetchFn, "Unexpected answer"],
      [fakeSanity({ anonymous: { total: 0 }, withToken: "x" }).fetchFn, "Unexpected answer"],
      [
        (async () => {
          throw new TypeError("fetch failed");
        }) as typeof fetch,
        "couldn't be reached: TypeError: fetch failed",
      ],
    ];
    for (const [fetchFn, message] of cases) {
      const result = await checkPrivateDataset({ ...OPTIONS, token: "sk-test", fetch: fetchFn });
      expect(result.status, message).toBe("unknown");
      expect(result.message, message).toContain(message);
    }
  });

  it("exits 0 for private, 1 for public and 2 when it can't tell", () => {
    expect(EXIT_CODES).toEqual({ private: 0, public: 1, unknown: 2 });
  });
});

describe("ANONYMOUS_QUERY", () => {
  it("counts every document and lists the members-only ones", async () => {
    const dataset = [
      { _id: "p1", _type: "post", visibility: { audience: "everyone" } },
      { _id: "p2", _type: "post", visibility: { audience: "members" } },
      { _id: "e1", _type: "event", visibility: { audience: "levels", levels: ["band"] } },
      { _id: "g1", _type: "page" },
      { _id: "v1", _type: "venue", name: "The Blue Door" },
    ];
    const result = await (await evaluate(parse(ANONYMOUS_QUERY), { dataset })).get();
    expect(result).toEqual({
      total: 5,
      membersOnly: [
        { _id: "p2", _type: "post" },
        { _id: "e1", _type: "event" },
        { _id: "g1", _type: "page" },
      ],
    });
  });
});
