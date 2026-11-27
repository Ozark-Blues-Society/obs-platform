// A stand-in for Stripe's API, for tests only: a test-mode account kept in memory behind a `fetch`,
// for the Stripe SDK to use as its HTTP client (Stripe.createFetchHttpClient). Nothing here talks
// to Stripe. It answers the requests `pnpm stripe:prices` makes (scripts/stripe/prices.mts) the way
// Stripe's API reference says it does (docs.stripe.com/api, version 2026-11-18.endive, read
// 2026-11-27):
//   - a product can be created with an id of our own, which must be unique; retrieving a product
//     that doesn't exist answers 404 with the code resource_missing;
//   - a lookup key belongs to one price at a time, archived or not: creating or updating a price
//     with a key another price has fails, unless transfer_lookup_key moves the key over;
//   - a price's amount, currency, billing and product never change; its nickname, metadata and
//     whether it's active can;
//   - metadata updates merge: keys that aren't sent stay, and an empty value removes a key;
//   - listing prices by lookup_keys finds archived prices too, unless `active` is given.
// scripts/stripe/prices.test.ts uses it.

export interface FakeProduct {
  id: string;
  object: "product";
  active: boolean;
  name: string;
  metadata: Record<string, string>;
  livemode: false;
}

export interface FakePrice {
  id: string;
  object: "price";
  active: boolean;
  product: string;
  currency: string;
  unit_amount: number;
  type: "one_time" | "recurring";
  recurring: { interval: string; interval_count: number; usage_type: "licensed" } | null;
  lookup_key: string | null;
  nickname: string | null;
  metadata: Record<string, string>;
  livemode: false;
}

export interface FakeRequest {
  method: string;
  /** The path, such as /v1/prices. */
  path: string;
  /**
   * The form body or query string, decoded: `metadata[level]=band` is
   * { metadata: { level: "band" } }.
   */
  params: Params;
}

type Params = { [key: string]: string | Params };

/**
 * Stripe's form encoding, decoded into nested objects of strings. A list's items are keyed by their
 * place in it: `lookup_keys[0]=a` is { lookup_keys: { 0: "a" } }.
 */
function decode(form: string): Params {
  const params: Params = {};
  for (const [key, value] of new URLSearchParams(form)) {
    const path = key.replaceAll("]", "").split("[");
    let node = params;
    for (const part of path.slice(0, -1)) node = (node[part] ??= {}) as Params;
    node[path.at(-1)!] = value;
  }
  return params;
}

const text = (value: string | Params | undefined) =>
  typeof value === "string" ? value : undefined;
const list = (value: string | Params | undefined) =>
  typeof value === "object" ? Object.values(value).filter((v) => typeof v === "string") : [];

/** Merges a metadata update into `metadata`, as Stripe does: an empty value removes the key. */
function merge(metadata: Record<string, string>, update: string | Params | undefined) {
  for (const [key, value] of Object.entries(typeof update === "object" ? update : {})) {
    if (value === "") delete metadata[key];
    else if (typeof value === "string") metadata[key] = value;
  }
}

export function fakeStripe() {
  const products = new Map<string, FakeProduct>();
  const prices = new Map<string, FakePrice>();
  const requests: FakeRequest[] = [];
  /** Requests to fail once each with a 500, as Stripe answers when something goes wrong there. */
  const failures: ((request: FakeRequest) => boolean)[] = [];
  let nextId = 1;

  const json = (status: number, body: unknown) => Response.json(body, { status });
  const invalid = (
    status: number,
    message: string,
    extra: { code?: string; param?: string } = {},
  ) => json(status, { error: { type: "invalid_request_error", message, ...extra } });
  const keyHolder = (key: string) => [...prices.values()].find((p) => p.lookup_key === key);

  /** Gives `price` the lookup key, taking it from another price only if `transfer` is "true". */
  function setLookupKey(price: FakePrice, key: string | undefined, transfer: string | undefined) {
    if (key === undefined) return undefined;
    const holder = keyHolder(key);
    if (holder && holder !== price) {
      if (transfer !== "true") {
        return invalid(400, `A price (${holder.id}) already uses that lookup key.`, {
          param: "lookup_key",
        });
      }
      holder.lookup_key = null;
    }
    price.lookup_key = key;
    return undefined;
  }

  function answer({ method, path, params }: FakeRequest): Response {
    const [, , collection, id] = path.split("/").map(decodeURIComponent);

    if (collection === "products" && id !== undefined) {
      const product = products.get(id);
      if (!product) {
        return invalid(404, `No such product: '${id}'`, { code: "resource_missing", param: "id" });
      }
      if (method === "POST") {
        if (params.name !== undefined) product.name = text(params.name) ?? product.name;
        if (params.active !== undefined) product.active = params.active === "true";
        merge(product.metadata, params.metadata);
      }
      return json(200, product);
    }

    if (collection === "products" && method === "POST") {
      const productId = text(params.id) ?? `prod_fake${nextId++}`;
      if (products.has(productId)) {
        return invalid(400, `Product already exists.`, {
          code: "resource_already_exists",
          param: "id",
        });
      }
      const product: FakeProduct = {
        id: productId,
        object: "product",
        active: params.active !== "false",
        name: text(params.name) ?? "",
        metadata: {},
        livemode: false,
      };
      merge(product.metadata, params.metadata);
      products.set(productId, product);
      return json(200, product);
    }

    if (collection === "prices" && id !== undefined && method === "POST") {
      const price = prices.get(id);
      if (!price) {
        return invalid(404, `No such price: '${id}'`, { code: "resource_missing", param: "id" });
      }
      const refused = setLookupKey(
        price,
        text(params.lookup_key),
        text(params.transfer_lookup_key),
      );
      if (refused) return refused;
      if (params.active !== undefined) price.active = params.active === "true";
      if (params.nickname !== undefined) price.nickname = text(params.nickname) || null;
      merge(price.metadata, params.metadata);
      return json(200, price);
    }

    if (collection === "prices" && method === "POST") {
      const productId = text(params.product) ?? "";
      if (!products.has(productId)) {
        return invalid(400, `No such product: '${productId}'`, {
          code: "resource_missing",
          param: "product",
        });
      }
      const recurring = typeof params.recurring === "object" ? params.recurring : undefined;
      const price: FakePrice = {
        id: `price_fake${nextId++}`,
        object: "price",
        active: params.active !== "false",
        product: productId,
        currency: text(params.currency) ?? "",
        unit_amount: Number(text(params.unit_amount)),
        type: recurring ? "recurring" : "one_time",
        recurring: recurring
          ? {
              interval: text(recurring.interval) ?? "",
              interval_count: Number(text(recurring.interval_count) ?? 1),
              usage_type: "licensed",
            }
          : null,
        lookup_key: null,
        nickname: text(params.nickname) ?? null,
        metadata: {},
        livemode: false,
      };
      const refused = setLookupKey(
        price,
        text(params.lookup_key),
        text(params.transfer_lookup_key),
      );
      if (refused) return refused;
      merge(price.metadata, params.metadata);
      prices.set(price.id, price);
      return json(200, price);
    }

    if (collection === "prices" && id === undefined && method === "GET") {
      const keys = list(params.lookup_keys);
      const data = [...prices.values()].filter(
        (price) =>
          (keys.length === 0 || (price.lookup_key !== null && keys.includes(price.lookup_key))) &&
          (params.active === undefined || String(price.active) === params.active) &&
          (params.product === undefined || price.product === params.product),
      );
      return json(200, { object: "list", url: "/v1/prices", has_more: false, data });
    }

    return invalid(404, `Unrecognized request URL (${method}: ${path}).`);
  }

  async function fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = (init.method ?? "GET").toUpperCase();
    const form = method === "GET" ? url.search.slice(1) : String(init.body ?? "");
    const request: FakeRequest = { method, path: url.pathname, params: decode(form) };
    requests.push(request);
    const failure = failures.findIndex((match) => match(request));
    if (failure >= 0) {
      failures.splice(failure, 1);
      return json(500, { error: { type: "api_error", message: "Something went wrong." } });
    }
    return answer(request);
  }

  return {
    products,
    prices,
    requests,
    fetch,
    /** Makes the next request that `match` accepts fail with a 500. */
    failOnce(match: (request: FakeRequest) => boolean) {
      failures.push(match);
    },
  };
}
