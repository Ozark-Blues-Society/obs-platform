// @vitest-environment node
// The Zeffy client against a stand-in for Zeffy that answers with the fixtures. Each request it
// sends is checked against the spec snapshot: the path and method of an operation there, and only
// query parameters that operation declares. Zeffy has no test mode, so a net guard refuses every
// network connection, and the suite fails if any test tried one.
import dns from "node:dns";
import { readFileSync } from "node:fs";
import net from "node:net";
import { inspect } from "node:util";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createZeffyClient,
  getZeffyClient,
  isZeffyError,
  PAGE_SIZE,
  ZeffyError,
  ZeffyPageLimitError,
  ZeffyResponseError,
  type ZeffyClientOptions,
} from "./client";
import {
  disputedMembershipPayment,
  donorContact,
  listedCampaign,
  memberContact,
  membershipCampaign,
  offlineMembershipPayment,
  recurringMembershipPayment,
  refundedMembershipPayment,
  ticketingCampaign,
  zeffyErrors,
  zeffyList,
} from "./fixtures";
import { MEMBERSHIP_CAMPAIGN_ID, ZEFFY_LEVEL_MAPPING } from "./level-mapping";
import {
  createPaymentRequestSchema,
  upsertContactRequestSchema,
  ZEFFY_SPEC_SNAPSHOT,
  type ZeffyCreatePaymentRequest,
} from "./schemas";

// --- Net guard -----------------------------------------------------------------------------------

/** Every connection a test tried. The first test (the control) clears its own. */
const attempts: string[] = [];

function target(args: unknown[]): string {
  // net.connect() hands Socket#connect its arguments as one array; tls.connect() an options object.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "object" && first !== null) {
    const { host, port, path } = first as { host?: string; port?: number; path?: string };
    return path ?? `${host}:${port}`;
  }
  return String(first);
}

beforeAll(() => {
  vi.spyOn(net.Socket.prototype, "connect").mockImplementation(function (...args: unknown[]) {
    attempts.push(target(args));
    throw new Error(`Net guard: these tests don't connect anywhere (${target(args)})`);
  });
  vi.spyOn(dns, "lookup").mockImplementation(((hostname: string) => {
    attempts.push(`DNS ${hostname}`);
    throw new Error(`Net guard: these tests don't look up ${hostname}`);
  }) as unknown as typeof dns.lookup);
});

afterAll(() => {
  vi.restoreAllMocks();
  expect(attempts, "network connections the tests tried").toEqual([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// --- The stand-in --------------------------------------------------------------------------------

const API_KEY = "made-up-zeffy-key";

interface Sent {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

/** An answer from the stand-in: JSON unless `body` is a string. */
function answer(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A client whose requests go to a stand-in that gives these answers, in order. */
function clientAnswering(answers: Response[], options: Partial<ZeffyClientOptions> = {}) {
  const sent: Sent[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    sent.push({
      method: init.method ?? "GET",
      url: new URL(String(input)),
      headers: new Headers(init.headers),
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const next = answers.shift();
    if (!next) throw new Error("The stand-in for Zeffy has no answer left");
    return next;
  });
  const client = createZeffyClient({ apiKey: API_KEY, fetch, ...options });
  return { client, sent };
}

const spec = JSON.parse(
  readFileSync(new URL(`../../${ZEFFY_SPEC_SNAPSHOT}`, import.meta.url), "utf8"),
) as {
  servers: { url: string }[];
  paths: Record<string, Record<string, { parameters?: { name: string; in: string }[] }>>;
};

/** Checks a request against the snapshot and returns the operation's path, as "GET /api/...". */
function specOperation(request: Sent): string {
  expect(request.url.origin).toBe(spec.servers[0].url);
  const path = Object.keys(spec.paths).find((template) =>
    new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(request.url.pathname),
  );
  expect(path, request.url.pathname).toBeDefined();
  const operation = spec.paths[path!][request.method.toLowerCase()];
  expect(operation, `${request.method} ${path}`).toBeDefined();
  const declared = (operation.parameters ?? []).filter((p) => p.in === "query").map((p) => p.name);
  for (const key of request.url.searchParams.keys()) expect(declared, path).toContain(key);
  return `${request.method} ${path}`;
}

const query = (request: Sent) => Object.fromEntries(request.url.searchParams);

/** A promise's error, caught at once so a rejection waiting on fake timers isn't unhandled. */
function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the request to fail");
    },
    (error: unknown) => error,
  );
}

// --- Tests ---------------------------------------------------------------------------------------

describe("the net guard", () => {
  it("stops a real request (control): the client's own fetch can't reach Zeffy", async () => {
    const client = createZeffyClient({ apiKey: API_KEY });
    await expect(client.getPayment(recurringMembershipPayment.id)).rejects.toThrow();
    expect(attempts.some((attempt) => attempt.includes("api.zeffy.com"))).toBe(true);
    attempts.length = 0;
  });
});

describe("requests", () => {
  it("sends the API key as a bearer token with every request, never in the address", async () => {
    const { client, sent } = clientAnswering([
      answer(200, zeffyList([recurringMembershipPayment])),
      answer(200, recurringMembershipPayment),
      answer(201, offlineMembershipPayment),
      answer(200, memberContact),
      answer(200, zeffyList([listedCampaign(membershipCampaign)])),
      answer(200, membershipCampaign),
    ]);
    await client.listPayments();
    await client.getPayment(recurringMembershipPayment.id);
    await client.createOfflinePayment({ campaign_id: MEMBERSHIP_CAMPAIGN_ID, amount: 3000 });
    await client.upsertContact({ email: memberContact.email });
    await client.listCampaigns();
    await client.getCampaign(membershipCampaign.id);

    expect(sent).toHaveLength(6);
    for (const request of sent) {
      expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      expect(request.headers.get("accept")).toBe("application/json");
      expect(request.headers.get("user-agent")).toBe("obs-platform");
      expect(request.url.href).not.toContain(API_KEY);
    }
    expect(sent.map(specOperation)).toEqual([
      "GET /api/v1/payments",
      "GET /api/v1/payments/{id}",
      "POST /api/v1/payments",
      "PUT /api/v1/contacts",
      "GET /api/v1/campaigns",
      "GET /api/v1/campaigns/{id}",
    ]);
  });

  it("lists payments page after page, following next_cursor until has_more is false", async () => {
    const pages = [
      zeffyList([recurringMembershipPayment], recurringMembershipPayment.id),
      zeffyList([refundedMembershipPayment], refundedMembershipPayment.id),
      zeffyList([disputedMembershipPayment]),
    ];
    const { client, sent } = clientAnswering(pages.map((page) => answer(200, page)));

    const payments = await client.listPayments({
      contact: memberContact.id,
      campaign: MEMBERSHIP_CAMPAIGN_ID,
      type: "online",
      status: "succeeded",
      currency: "usd",
    });

    expect(payments).toStrictEqual([
      recurringMembershipPayment,
      refundedMembershipPayment,
      disputedMembershipPayment,
    ]);
    const filters = {
      contact: memberContact.id,
      campaign: MEMBERSHIP_CAMPAIGN_ID,
      type: "online",
      status: "succeeded",
      currency: "usd",
      limit: String(PAGE_SIZE),
    };
    expect(sent.map(query)).toEqual([
      filters,
      { ...filters, starting_after: recurringMembershipPayment.id },
      { ...filters, starting_after: refundedMembershipPayment.id },
    ]);
    expect(PAGE_SIZE).toBe(100);
    sent.forEach(specOperation);
  });

  it("filters by created time in whole seconds, keeping exactly the range's records", async () => {
    const { client, sent } = clientAnswering([
      answer(200, zeffyList([])),
      answer(200, zeffyList([])),
    ]);
    const halfPast = (seconds: number) => new Date(seconds * 1000 + 500);

    await client.listPayments({ created: { gte: halfPast(1795618800), lt: halfPast(1795700000) } });
    await client.listCampaigns({
      creatorUserId: membershipCampaign.creator_user_id,
      created: { gt: halfPast(1790000000), lte: halfPast(1791000000) },
    });

    // A record at 1795618800 is before 1795618800.5, so gte rounds up; one at 1795700000 is
    // before 1795700000.5, so lt rounds up too. gt and lte round down.
    expect(sent.map(query)).toEqual([
      { "created[gte]": "1795618801", "created[lt]": "1795700001", limit: "100" },
      {
        creator_user_id: membershipCampaign.creator_user_id,
        "created[gt]": "1790000000",
        "created[lte]": "1791000000",
        limit: "100",
      },
    ]);
    sent.forEach(specOperation);
  });

  it("stops after the page limit when more pages follow", async () => {
    const page = (n: number) => zeffyList([recurringMembershipPayment], `cursor-${n}`);
    const { client, sent } = clientAnswering([1, 2, 3].map((n) => answer(200, page(n))));

    const error = await failure(client.listPayments({}, { maxPages: 2 }));

    expect(error).toBeInstanceOf(ZeffyPageLimitError);
    expect(error).toMatchObject({ pages: 2 });
    expect(sent).toHaveLength(2);
  });

  it("stops at 20 pages unless told otherwise", async () => {
    const pages = Array.from({ length: 21 }, (_, n) => answer(200, zeffyList([], `cursor-${n}`)));
    const { client, sent } = clientAnswering(pages);

    expect(await failure(client.listCampaigns())).toBeInstanceOf(ZeffyPageLimitError);
    expect(sent).toHaveLength(20);
  });

  it("refuses a page that says more follow but gives no cursor", async () => {
    const { client } = clientAnswering([
      answer(200, { ...zeffyList([recurringMembershipPayment]), has_more: true }),
    ]);
    const error = await failure(client.listPayments());
    expect(error).toBeInstanceOf(ZeffyResponseError);
    expect((error as Error).message).toContain("no next_cursor");
  });

  it("gets a payment, or null when Zeffy has none with that id", async () => {
    const { client, sent } = clientAnswering([
      answer(200, refundedMembershipPayment),
      answer(404, zeffyErrors.resourceNotFound),
    ]);
    expect(await client.getPayment(refundedMembershipPayment.id)).toStrictEqual(
      refundedMembershipPayment,
    );
    expect(await client.getPayment(disputedMembershipPayment.id)).toBeNull();
    expect(sent.map((request) => request.url.pathname)).toEqual([
      `/api/v1/payments/${refundedMembershipPayment.id}`,
      `/api/v1/payments/${disputedMembershipPayment.id}`,
    ]);
    expect(sent.every((request) => request.body === undefined)).toBe(true);
  });

  it("refuses an id that would change the path, without sending anything", async () => {
    const { client, sent } = clientAnswering([]);
    for (const id of ["..", "../contacts", "a/b", "", "a?b", "jesse.carter@example.com"]) {
      await expect(client.getPayment(id), id).rejects.toThrow(TypeError);
      await expect(client.getCampaign(id), id).rejects.toThrow(TypeError);
    }
    expect(sent).toEqual([]);
  });

  it("records an offline payment: one membership rate, paid by cheque", async () => {
    const sponsor = ZEFFY_LEVEL_MAPPING.find((mapping) => mapping.level === "sponsor")!;
    const [nameQuestion, emailQuestion] = membershipCampaign.questions;
    const payment = {
      campaign_id: sponsor.campaignId,
      tickets: [
        {
          rate_id: sponsor.rateId,
          quantity: 1,
          attendees: [
            {
              answers: [
                { question_id: nameQuestion.id, answer: "Curtis Bell" },
                { question_id: emailQuestion.id, answer: "curtis.bell@example.com" },
              ],
            },
          ],
        },
      ],
      payment_method: "cheque",
      email: "curtis.bell@example.com",
      first_name: "Curtis",
      last_name: "Bell",
      payment_date: "2026-11-25",
    } satisfies ZeffyCreatePaymentRequest;
    const { client, sent } = clientAnswering([answer(201, offlineMembershipPayment)]);

    expect(await client.createOfflinePayment(payment)).toStrictEqual(offlineMembershipPayment);

    expect(specOperation(sent[0])).toBe("POST /api/v1/payments");
    expect(sent[0].headers.get("content-type")).toBe("application/json");
    expect(sent[0].body).toEqual(payment);
    expect(createPaymentRequestSchema.strict().safeParse(sent[0].body).success).toBe(true);
  });

  it("upserts a contact by email: created when Zeffy answers 201, updated on 200", async () => {
    const { client, sent } = clientAnswering([
      answer(201, donorContact),
      answer(200, memberContact),
    ]);
    const update = {
      email: memberContact.email,
      first_name: "Jesse",
      last_name: "Carter",
      phone_number: null,
    };

    expect(await client.upsertContact({ email: donorContact.email })).toStrictEqual({
      contact: donorContact,
      created: true,
    });
    expect(await client.upsertContact(update)).toStrictEqual({
      contact: memberContact,
      created: false,
    });

    expect(sent.map((request) => request.body)).toEqual([{ email: donorContact.email }, update]);
    for (const request of sent) {
      expect(specOperation(request)).toBe("PUT /api/v1/contacts");
      expect(upsertContactRequestSchema.strict().safeParse(request.body).success).toBe(true);
    }
  });

  it("sends an upsert once more after a 409, which Zeffy says is transient", async () => {
    const conflict = () => answer(409, zeffyErrors.emailAlreadyUsed);
    const once = clientAnswering([conflict(), answer(200, memberContact)]);
    expect(await once.client.upsertContact({ email: memberContact.email })).toStrictEqual({
      contact: memberContact,
      created: false,
    });
    expect(once.sent).toHaveLength(2);

    const twice = clientAnswering([conflict(), conflict(), answer(200, memberContact)]);
    const error = await failure(twice.client.upsertContact({ email: memberContact.email }));
    expect(error).toMatchObject({ status: 409, code: "email_already_used", param: "email" });
    expect(twice.sent).toHaveLength(2);
  });

  it("lists campaigns, and gets one with its questions and rates, or null", async () => {
    const listed = [listedCampaign(membershipCampaign), listedCampaign(ticketingCampaign)];
    const { client, sent } = clientAnswering([
      answer(200, zeffyList(listed)),
      answer(200, ticketingCampaign),
      answer(404, zeffyErrors.resourceNotFound),
    ]);

    const campaigns = await client.listCampaigns();
    expect(campaigns).toStrictEqual(listed);
    expect(campaigns[0]).not.toHaveProperty("rates");
    expect(await client.getCampaign(ticketingCampaign.id)).toStrictEqual(ticketingCampaign);
    expect(await client.getCampaign(membershipCampaign.id)).toBeNull();
    expect(sent.map(specOperation)).toEqual([
      "GET /api/v1/campaigns",
      "GET /api/v1/campaigns/{id}",
      "GET /api/v1/campaigns/{id}",
    ]);
  });
});

describe("429 and Retry-After", () => {
  const tooMany = (retryAfter?: string) =>
    answer(429, zeffyErrors.rateLimitExceeded, retryAfter ? { "retry-after": retryAfter } : {});

  it.each([
    ["1", 1_000], // the per-second window
    ["60", 60_000], // the per-minute window
    [undefined, 60_000], // no Retry-After: wait out a minute
  ])("waits out Retry-After %s (%i ms), then tries again", async (header, waitMs) => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering([
      tooMany(header),
      answer(200, recurringMembershipPayment),
    ]);

    const payment = client.getPayment(recurringMembershipPayment.id);
    await vi.advanceTimersByTimeAsync(waitMs - 1);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    expect(await payment).toStrictEqual(recurringMembershipPayment);
  });

  it("reads Retry-After as an HTTP date too", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-27T12:00:00Z") });
    const { client, sent } = clientAnswering([
      tooMany("Fri, 27 Nov 2026 12:00:05 GMT"),
      answer(200, zeffyList([])),
    ]);

    const payments = client.listPayments();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await payments).toEqual([]);
    expect(sent).toHaveLength(2);
  });

  it("gives up after maxRetries 429s in a row", async () => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering([tooMany("1"), tooMany("1"), tooMany("1")], {
      maxRetries: 2,
    });

    const error = failure(client.listPayments());
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await error).toMatchObject({
      name: "ZeffyError",
      status: 429,
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
      retryAfterSeconds: 1,
    });
    expect(sent).toHaveLength(3);
  });

  it("tries 4 times in all unless told otherwise", async () => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering(Array.from({ length: 5 }, () => tooMany("1")));
    const error = failure(client.listCampaigns());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await error).toBeInstanceOf(ZeffyError);
    expect(sent).toHaveLength(4);
  });

  it("fails at once when the wait would end after the deadline", async () => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering([tooMany("60"), answer(200, zeffyList([]))], {
      deadline: Date.now() + 30_000,
    });

    const error = await failure(client.listPayments());

    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 60 });
    expect(sent).toHaveLength(1);
  });

  it("waits when the wait ends by the deadline", async () => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering([tooMany("1"), answer(200, zeffyList([]))], {
      deadline: Date.now() + 1_000,
    });
    const payments = client.listPayments();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await payments).toEqual([]);
    expect(sent).toHaveLength(2);
  });

  it("won't wait more than two minutes", async () => {
    vi.useFakeTimers();
    const { client, sent } = clientAnswering([tooMany("121"), answer(200, zeffyList([]))]);
    expect(await failure(client.listPayments())).toMatchObject({ retryAfterSeconds: 121 });
    expect(sent).toHaveLength(1);
  });
});

describe("errors", () => {
  it.each(Object.entries(zeffyErrors))("turns %s into a ZeffyError", async (_name, envelope) => {
    const { client } = clientAnswering([answer(envelope.error.status, envelope)], {
      maxRetries: 0,
    });

    const error = await failure(client.listPayments());

    expect(error).toBeInstanceOf(ZeffyError);
    const { status, type, code, param, message } = envelope.error;
    expect(error).toMatchObject({ status, type, code, param, zeffyMessage: message });
    const reason = [`HTTP ${status}`, code, param && `on ${param}`].filter(Boolean).join(", ");
    expect((error as Error).message).toBe(`Zeffy refused to list payments (${reason})`);
  });

  it("refuses writes with organization_not_verified until Zeffy verifies the Society", async () => {
    const notVerified = () => answer(403, zeffyErrors.organizationNotVerified);
    const { client } = clientAnswering([notVerified(), notVerified()]);

    const errors = [
      await failure(client.createOfflinePayment({ campaign_id: MEMBERSHIP_CAMPAIGN_ID })),
      await failure(client.upsertContact({ email: memberContact.email })),
    ];

    for (const error of errors) {
      expect(isZeffyError(error, "organization_not_verified")).toBe(true);
      expect(isZeffyError(error, "invalid_api_key")).toBe(false);
      expect(isZeffyError(error)).toBe(true);
      expect(error).toMatchObject({ status: 403, type: "invalid_request_error" });
    }
    expect(isZeffyError(new Error("something else"))).toBe(false);
  });

  it("keeps Zeffy's message, which can hold an address, out of the text and logs", async () => {
    const conflict = () => answer(409, zeffyErrors.emailAlreadyUsed);
    const { client } = clientAnswering([conflict(), conflict()]);

    const error = (await failure(
      client.upsertContact({ email: memberContact.email }),
    )) as ZeffyError;

    expect(error.zeffyMessage).toContain("jesse.carter@example.com");
    expect(error.message).not.toContain("jesse.carter");
    expect(inspect(error)).not.toContain("jesse.carter");
    expect(JSON.stringify(error)).not.toContain("jesse.carter");
  });

  it("makes a ZeffyError of a failure without Zeffy's envelope", async () => {
    const { client } = clientAnswering([answer(502, "<html>Bad gateway</html>")]);
    const error = await failure(client.getCampaign(ticketingCampaign.id));
    expect(error).toMatchObject({ status: 502, type: null, code: null, param: null });
    expect((error as Error).message).toBe("Zeffy refused to get a campaign (HTTP 502)");
  });

  it("refuses an answer that breaks the spec, naming the field but not the value", async () => {
    const { client } = clientAnswering([
      answer(200, { ...recurringMembershipPayment, refund_status: "chargeback-zzmarker" }),
      answer(200, { ...memberContact, email: 42 }),
      answer(200, "not json"),
    ]);

    const wrongValue = await failure(client.getPayment(recurringMembershipPayment.id));
    expect(wrongValue).toBeInstanceOf(ZeffyResponseError);
    expect((wrongValue as Error).message).toContain("refund_status");
    expect((wrongValue as Error).message).not.toContain("zzmarker");

    const wrongType = await failure(client.upsertContact({ email: memberContact.email }));
    expect((wrongType as Error).message).toContain("email");
    expect((wrongType as Error).message).not.toContain("42");

    const notJson = await failure(client.getPayment(recurringMembershipPayment.id));
    expect((notJson as Error).message).toBe(
      "Zeffy's answer to the request to get a payment wasn't JSON",
    );
  });
});

describe("getZeffyClient", () => {
  it("is null until ZEFFY_API_KEY is set", () => {
    vi.stubEnv("ZEFFY_API_KEY", "");
    expect(getZeffyClient()).toBeNull();
    vi.stubEnv("ZEFFY_API_KEY", API_KEY);
    expect(getZeffyClient()).toMatchObject({
      listPayments: expect.any(Function),
      createOfflinePayment: expect.any(Function),
    });
  });
});
