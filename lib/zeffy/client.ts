// Zeffy's Public API v1 (decision 0007), for the parts of the site that read or write Zeffy data:
// membership payments (M-5), check and cash payments written to Zeffy (A-1), contacts (Z-4) and
// ticketing campaigns (Z-1 to Z-3, Z-5). It is built against the spec snapshot
// (ZEFFY_SPEC_SNAPSHOT in lib/zeffy/schemas.ts), and every answer is checked against those schemas.
//
// Zeffy has no test mode, so nothing in the factory or CI calls the real API: the tests answer the
// client with fixtures (lib/zeffy/fixtures.ts). getZeffyClient() returns null until ZEFFY_API_KEY
// is set, which a human does on Netlify staging and production only.
//
// How it talks to Zeffy:
// - Bearer auth with the organization's API key.
// - Lists follow next_cursor, 100 records a page, until has_more is false, and stop with a
//   ZeffyPageLimitError after maxPages pages (20 unless the caller says otherwise).
// - Zeffy allows 100 requests a minute and 20 a second per organization, and answers 429 with
//   Retry-After (60 or 1 seconds). The client waits that long and tries again, up to maxRetries
//   times, but never past the caller's deadline, and never for longer than 2 minutes.
// - Any other failure is a ZeffyError carrying Zeffy's status, type, code and param. Writes fail
//   with 403 organization_not_verified until the Society finishes Zeffy's Stripe verification.
import "server-only";
import type { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import {
  campaignSchema,
  contactSchema,
  listSchema,
  paymentSchema,
  type ZeffyCampaign,
  type ZeffyContact,
  type ZeffyCreatePaymentRequest,
  type ZeffyErrorEnvelope,
  type ZeffyListCampaignsQuery,
  type ZeffyListPaymentsQuery,
  type ZeffyPayment,
  type ZeffyUpsertContactRequest,
} from "./schemas";

const API_URL = "https://api.zeffy.com/api/v1/";

/** A request that hangs gives up after this long. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Records per page of a list: the most Zeffy allows. */
export const PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_RETRIES = 3;

/** Zeffy always sends Retry-After with a 429; without one, wait out its per-minute window. */
const RETRY_AFTER_WITHOUT_HEADER_S = 60;
/** A longer wait than this isn't worth holding a request open for: give up and say how long. */
const LONGEST_WAIT_S = 120;

/** Path segments are ids: Zeffy's are UUIDs. Anything else could change the path. */
const ZEFFY_ID = /^[A-Za-z0-9_-]{1,64}$/;

type ErrorBody = NonNullable<ZeffyErrorEnvelope["error"]>;

/** The family of a Zeffy failure. */
export type ZeffyErrorType = ErrorBody["type"];

/** Zeffy's error codes, from the spec snapshot. Zeffy can add more, so `code` can be any string. */
export type ZeffyErrorCode =
  // Any request
  | "invalid_parameters"
  | "invalid_request"
  | "invalid_api_key"
  | "resource_not_found"
  | "rate_limit_exceeded"
  | "internal_error"
  // Writes, until the Society finishes Zeffy's Stripe verification
  | "organization_not_verified"
  // PUT /contacts: another write reached the same email first (upsertContact tries once more)
  | "contact_already_exists"
  | "contact_not_found"
  | "email_already_used"
  // POST /payments: the payment doesn't fit the campaign
  | "campaign_type_not_supported"
  | "payment_method_not_allowed"
  | "ticketing_occurrence_is_not_link_to_ticketing"
  | "tickets_required_for_campaign"
  | "rate_not_found"
  | "duplicate_rate_ids"
  | "pwyc_amount_required"
  | "amount_not_allowed_for_fixed_rate"
  | "ticketing_is_full"
  | "full_choice_errors"
  | "tickets_not_allowed_for_campaign"
  | "missing_required_answers"
  | "question_not_found"
  | "question_scope_mismatch"
  | "choice_not_found"
  | "invalid_answer";

/**
 * Zeffy refused a request. The message names the request, the HTTP status and Zeffy's code. It
 * leaves out Zeffy's own message, which can repeat what was sent (an address, say), so the error
 * can go in a log: `zeffyMessage` has that, for showing to an administrator.
 */
export class ZeffyError extends Error {
  /** The HTTP status. */
  readonly status: number;
  /** null when the answer had no error envelope, as from a proxy in front of Zeffy. */
  readonly type: ZeffyErrorType | (string & {}) | null;
  readonly code: ZeffyErrorCode | (string & {}) | null;
  /** The request field at fault, when Zeffy can name one. */
  readonly param: string | null;
  /** For a 429 the client didn't wait out: how many seconds Zeffy asked for, if it said. */
  readonly retryAfterSeconds: number | null;
  // Private, so a logged error doesn't print it.
  readonly #zeffyMessage: string | null;

  constructor(
    what: string,
    details: {
      status: number;
      type?: string | null;
      code?: string | null;
      param?: string | null;
      message?: string | null;
      retryAfterSeconds?: number | null;
    },
  ) {
    const { status, type = null, code = null, param = null } = details;
    const reason = [`HTTP ${status}`, code, param && `on ${param}`].filter(Boolean).join(", ");
    super(`Zeffy refused to ${what} (${reason})`);
    this.name = "ZeffyError";
    this.status = status;
    this.type = type;
    this.code = code;
    this.param = param;
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.#zeffyMessage = details.message ?? null;
  }

  /** Zeffy's own explanation. It can hold what was sent: show it, don't log it. */
  get zeffyMessage(): string | null {
    return this.#zeffyMessage;
  }
}

/** Whether `error` is a ZeffyError, with this code if one is given. */
export function isZeffyError(error: unknown, code?: ZeffyErrorCode): error is ZeffyError {
  return error instanceof ZeffyError && (code === undefined || error.code === code);
}

/**
 * Zeffy's answer wasn't what the spec snapshot describes. The message names the fields, never
 * their values. If Zeffy's API changed, save a new snapshot (see lib/zeffy/schemas.ts).
 */
export class ZeffyResponseError extends Error {
  constructor(what: string, problem: string) {
    super(`Zeffy's answer to the request to ${what} ${problem}`);
    this.name = "ZeffyResponseError";
  }
}

/** A list had more pages than the caller allowed. Narrow it, with a created range for instance. */
export class ZeffyPageLimitError extends Error {
  constructor(
    what: string,
    readonly pages: number,
  ) {
    super(`Stopped the request to ${what} after ${pages} pages, with more to come`);
    this.name = "ZeffyPageLimitError";
  }
}

/** Records created after (gt), from (gte), before (lt) or up to (lte) these times. */
export interface CreatedRange {
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
}

export interface PaymentFilters {
  /** A contact's id. */
  contact?: string;
  /** A campaign's id. */
  campaign?: string;
  type?: ZeffyListPaymentsQuery["type"];
  status?: ZeffyListPaymentsQuery["status"];
  currency?: ZeffyListPaymentsQuery["currency"];
  created?: CreatedRange;
}

export interface CampaignFilters {
  /** The id of the Zeffy user who created the campaigns. */
  creatorUserId?: string;
  created?: CreatedRange;
}

export interface ListOptions {
  /** Stop with a ZeffyPageLimitError after this many pages of PAGE_SIZE records. Default 20. */
  maxPages?: number;
}

export interface ZeffyClient {
  /** Every payment that matches, newest first, as Zeffy lists them. */
  listPayments(filters?: PaymentFilters, options?: ListOptions): Promise<ZeffyPayment[]>;
  /** The payment, or null when Zeffy has none with this id (deleted, for one). */
  getPayment(id: string): Promise<ZeffyPayment | null>;
  /**
   * Records a payment made outside Zeffy, such as a check or cash for a membership (A-1): on the
   * membership form, one ticket of the level's rate. Zeffy finds or creates the contact by email.
   */
  createOfflinePayment(payment: ZeffyCreatePaymentRequest): Promise<ZeffyPayment>;
  /** Updates the contact with this email, or creates it (`created`). null clears a field. */
  upsertContact(
    contact: ZeffyUpsertContactRequest,
  ): Promise<{ contact: ZeffyContact; created: boolean }>;
  /** Every campaign that matches. Lists leave out each campaign's questions and rates. */
  listCampaigns(filters?: CampaignFilters, options?: ListOptions): Promise<ZeffyCampaign[]>;
  /** The campaign with its questions and rates, or null when Zeffy has none with this id. */
  getCampaign(id: string): Promise<ZeffyCampaign | null>;
}

export interface ZeffyClientOptions {
  /** The organization's API key. */
  apiKey: string;
  /** Tests pass a stand-in. */
  fetch?: typeof globalThis.fetch;
  /** How many 429s one request may wait out before it fails. Default 3. */
  maxRetries?: number;
  /**
   * A time (Date.now() milliseconds) to finish by: a 429 whose wait would end later fails at once.
   * Set it when something has a time limit, such as a scheduled function or a waiting visitor.
   */
  deadline?: number;
}

type Query = Record<string, string | number | undefined>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retry-After in seconds: a number of seconds, or an HTTP date. null when it's neither. */
function retryAfterSeconds(header: string | null): number | null {
  if (header === null) return null;
  if (/^\d+$/.test(header.trim())) return Number(header.trim());
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * The created[...] filters, in Unix seconds. Zeffy's times are whole seconds, so each bound rounds
 * the way that keeps exactly the records the Date range holds.
 */
function createdQuery(range: CreatedRange = {}) {
  const seconds = (date: Date | undefined, round: (value: number) => number) =>
    date === undefined ? undefined : round(date.getTime() / 1000);
  return {
    "created[gt]": seconds(range.gt, Math.floor),
    "created[gte]": seconds(range.gte, Math.ceil),
    "created[lt]": seconds(range.lt, Math.ceil),
    "created[lte]": seconds(range.lte, Math.floor),
  };
}

function idPath(collection: string, id: string): string {
  if (!ZEFFY_ID.test(id)) throw new TypeError("Not a Zeffy id");
  return `${collection}/${id}`;
}

/** The answer checked against its schema, or a ZeffyResponseError naming what doesn't fit. */
function check<S extends z.ZodType>(schema: S, data: unknown, what: string): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // zod's messages name the expected type or values, never the value received.
  const problems = result.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "the answer"}: ${issue.message}`);
  throw new ZeffyResponseError(what, `doesn't match the API spec (${problems.join("; ")})`);
}

export function createZeffyClient(options: ZeffyClientOptions): ZeffyClient {
  const { apiKey, fetch = globalThis.fetch, maxRetries = DEFAULT_MAX_RETRIES, deadline } = options;

  /**
   * Sends a request, waiting out 429s, and returns the status and the parsed JSON. `what` names it
   * in errors, which end up in logs: never the URL or body, which can hold a member's address.
   */
  async function request(
    what: string,
    method: string,
    path: string,
    { query = {}, body }: { query?: Query; body?: unknown } = {},
  ): Promise<{ status: number; data: unknown }> {
    const url = new URL(path, API_URL);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          "user-agent": "obs-platform",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
      if (response.ok) {
        if (data === undefined) throw new ZeffyResponseError(what, "wasn't JSON");
        return { status: response.status, data };
      }

      const retryAfter =
        response.status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : null;
      if (response.status === 429 && attempt < maxRetries) {
        const waitMs = (retryAfter ?? RETRY_AFTER_WITHOUT_HEADER_S) * 1000;
        const inTime = deadline === undefined || Date.now() + waitMs <= deadline;
        if (waitMs <= LONGEST_WAIT_S * 1000 && inTime) {
          await sleep(waitMs);
          continue;
        }
      }

      // Read leniently: a proxy's error page, or a type Zeffy adds later, still makes an error.
      const error = (data as { error?: Partial<Record<keyof ErrorBody, unknown>> } | undefined)
        ?.error;
      const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);
      throw new ZeffyError(what, {
        status: response.status,
        type: stringOrNull(error?.type),
        code: stringOrNull(error?.code),
        param: stringOrNull(error?.param),
        message: stringOrNull(error?.message),
        retryAfterSeconds: retryAfter,
      });
    }
  }

  /** Every record of a list, page after page. */
  async function list<S extends z.ZodType>(
    what: string,
    path: string,
    query: Query,
    item: S,
    maxPages = DEFAULT_MAX_PAGES,
  ): Promise<z.output<S>[]> {
    const page = listSchema(item);
    const records: z.output<S>[] = [];
    let cursor: string | undefined;
    for (let pages = 1; ; pages += 1) {
      const { data } = await request(what, "GET", path, {
        query: { ...query, limit: PAGE_SIZE, starting_after: cursor },
      });
      const answer = check(page, data, what);
      records.push(...answer.data);
      if (!answer.has_more) return records;
      if (!answer.next_cursor) {
        throw new ZeffyResponseError(what, "says more records follow, but has no next_cursor");
      }
      if (pages >= maxPages) throw new ZeffyPageLimitError(what, pages);
      cursor = answer.next_cursor;
    }
  }

  /** One record, or null when Zeffy has none with that id (404). */
  async function getOne<S extends z.ZodType>(
    what: string,
    path: string,
    schema: S,
  ): Promise<z.output<S> | null> {
    let data: unknown;
    try {
      ({ data } = await request(what, "GET", path));
    } catch (error) {
      if (error instanceof ZeffyError && error.status === 404) return null;
      throw error;
    }
    return check(schema, data, what);
  }

  return {
    listPayments(filters = {}, { maxPages } = {}) {
      const query = {
        contact: filters.contact,
        campaign: filters.campaign,
        type: filters.type,
        status: filters.status,
        currency: filters.currency,
        ...createdQuery(filters.created),
      } satisfies ZeffyListPaymentsQuery;
      return list("list payments", "payments", query, paymentSchema, maxPages);
    },

    async getPayment(id) {
      return getOne("get a payment", idPath("payments", id), paymentSchema);
    },

    async createOfflinePayment(payment) {
      const what = "record an offline payment";
      const { data } = await request(what, "POST", "payments", { body: payment });
      return check(paymentSchema, data, what);
    },

    async upsertContact(contact) {
      const what = "upsert a contact";
      let answer: { status: number; data: unknown };
      try {
        answer = await request(what, "PUT", "contacts", { body: contact });
      } catch (error) {
        // 409: another write reached the same email first. Zeffy says the conflict is transient,
        // so the same request can be sent again.
        if (!(error instanceof ZeffyError && error.status === 409)) throw error;
        answer = await request(what, "PUT", "contacts", { body: contact });
      }
      return { contact: check(contactSchema, answer.data, what), created: answer.status === 201 };
    },

    listCampaigns(filters = {}, { maxPages } = {}) {
      const query = {
        creator_user_id: filters.creatorUserId,
        ...createdQuery(filters.created),
      } satisfies ZeffyListCampaignsQuery;
      return list("list campaigns", "campaigns", query, campaignSchema, maxPages);
    },

    async getCampaign(id) {
      return getOne("get a campaign", idPath("campaigns", id), campaignSchema);
    },
  };
}

/**
 * The Zeffy client for this environment's ZEFFY_API_KEY, or null while it isn't set. A human sets
 * it on Netlify staging and production only (decision 0007), so locally and in CI this is null.
 */
export function getZeffyClient(
  options: Omit<ZeffyClientOptions, "apiKey"> = {},
): ZeffyClient | null {
  const { ZEFFY_API_KEY: apiKey } = serverEnv("ZEFFY_API_KEY");
  return apiKey ? createZeffyClient({ ...options, apiKey }) : null;
}
