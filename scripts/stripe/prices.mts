/**
 * Makes the membership products and prices in Stripe match lib/stripe/catalog.ts (backlog M-3).
 * `pnpm stripe:prices` runs it (./setup-prices.mts). It works in Stripe test mode only: it refuses
 * any key but a test-mode secret or restricted key before sending anything, so it can't change
 * what live payments use.
 *
 * Running it again changes nothing. Each product has an id of our own, so the script retrieves it
 * by that id (Stripe's search can lag a minute behind), and each price is found by its lookup key.
 *   - Missing: created.
 *   - A product that was renamed or archived: renamed back and made active again.
 *   - A price whose amount, currency, billing or product is wrong (new dues, say): Stripe can't
 *     change those, so a new price takes over the lookup key and the old one is archived.
 *     Subscriptions on the old price keep it; this script doesn't move them.
 *   - A price whose nickname or metadata changed, or that was archived: updated and made active.
 * Metadata keys of our own are set; other keys are left alone. It never deletes anything, and never
 * touches a product or price that isn't in the catalog.
 */
import Stripe from "stripe";
import {
  CURRENCY,
  MEMBERSHIP_CATALOG,
  type CatalogPrice,
  type CatalogProduct,
} from "../../lib/stripe/catalog.ts";

export type Change = "created" | "updated" | "replaced" | "unchanged";

/** What a run did to one product or price. */
export interface Step {
  change: Change;
  kind: "product" | "price";
  /** The product's id or the price's lookup key. */
  key: string;
  /** "Band membership", or "$50.00 a year, renews automatically". */
  description: string;
  /** The price's Stripe id (the new price's, when replaced). */
  priceId?: string;
  /** The price that was replaced, now archived. */
  archivedPriceId?: string;
}

/** The key was missing or not a test-mode key: nothing was sent to Stripe. */
export class KeyRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyRefusedError";
  }
}

/** The key, trimmed, if it's a Stripe test-mode secret or restricted key. Throws otherwise. */
export function testModeKey(key: string | undefined): string {
  const trimmed = key?.trim() ?? "";
  if (!trimmed) {
    throw new KeyRefusedError(
      "STRIPE_SECRET_KEY isn't set. Put a test-mode secret key (sk_test_…) in .env.local (see the README).",
    );
  }
  if (/^[sr]k_live_/.test(trimmed)) {
    throw new KeyRefusedError(
      "STRIPE_SECRET_KEY is a live-mode key, and this script only works in test mode. Use a test key (sk_test_… or rk_test_…).",
    );
  }
  if (!/^[sr]k_test_/.test(trimmed)) {
    throw new KeyRefusedError(
      "STRIPE_SECRET_KEY isn't a Stripe test-mode secret key (sk_test_… or rk_test_…), so the script won't use it.",
    );
  }
  return trimmed;
}

const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** "$50.00 a year, renews automatically", or "$50.00 for one year, paid once". */
export function describePrice(price: CatalogPrice): string {
  return price.interval
    ? `${dollars(price.unitAmount)} a ${price.interval}, renews automatically`
    : `${dollars(price.unitAmount)} for one year, paid once`;
}

/** One line of the script's report. */
export function describeStep(step: Step): string {
  const ids = step.archivedPriceId
    ? ` (${step.priceId}; archived ${step.archivedPriceId})`
    : step.priceId
      ? ` (${step.priceId})`
      : "";
  return `${step.change.padEnd(9)} ${step.kind} ${step.key}: ${step.description}${ids}`;
}

/** "12 created, 0 updated, 0 replaced, 0 unchanged". */
export function summarize(steps: readonly Step[]): string {
  const changes: Change[] = ["created", "updated", "replaced", "unchanged"];
  return changes
    .map((change) => `${steps.filter((step) => step.change === change).length} ${change}`)
    .join(", ");
}

/** True when every key in `wanted` has that value in `metadata`. Other keys don't matter. */
function hasMetadata(metadata: Stripe.Metadata, wanted: Record<string, string>): boolean {
  return Object.entries(wanted).every(([key, value]) => metadata[key] === value);
}

/** "year" for a price that renews every year, null for a one-time price, "other" otherwise. */
function intervalOf(price: Stripe.Price): CatalogPrice["interval"] | "other" {
  if (price.type === "one_time") return null;
  const { interval, interval_count } = price.recurring ?? {};
  return interval === "year" && interval_count === 1 ? "year" : "other";
}

/** Whether a price charges what `wanted` says: the parts of a price that Stripe can't change. */
function charges(price: Stripe.Price, productId: string, wanted: CatalogPrice): boolean {
  const product = typeof price.product === "string" ? price.product : price.product.id;
  return (
    product === productId &&
    price.currency === CURRENCY &&
    price.unit_amount === wanted.unitAmount &&
    intervalOf(price) === wanted.interval
  );
}

async function retrieveProduct(stripe: Stripe, id: string): Promise<Stripe.Product | null> {
  try {
    return await stripe.products.retrieve(id);
  } catch (error) {
    if ((error as Stripe.errors.StripeError).code === "resource_missing") return null;
    throw error;
  }
}

async function syncProduct(stripe: Stripe, product: CatalogProduct): Promise<Step> {
  const step = (change: Change): Step => ({
    change,
    kind: "product",
    key: product.id,
    description: product.name,
  });
  const current = await retrieveProduct(stripe, product.id);
  if (!current) {
    await stripe.products.create({
      id: product.id,
      name: product.name,
      metadata: product.metadata,
    });
    return step("created");
  }
  if (
    current.active &&
    current.name === product.name &&
    hasMetadata(current.metadata, product.metadata)
  ) {
    return step("unchanged");
  }
  await stripe.products.update(product.id, {
    name: product.name,
    active: true,
    metadata: product.metadata,
  });
  return step("updated");
}

async function syncPrice(
  stripe: Stripe,
  productId: string,
  wanted: CatalogPrice,
  current: Stripe.Price | undefined,
): Promise<Step> {
  const step = (change: Change, priceId: string, archivedPriceId?: string): Step => ({
    change,
    kind: "price",
    key: wanted.lookupKey,
    description: describePrice(wanted),
    priceId,
    ...(archivedPriceId && { archivedPriceId }),
  });

  if (!current || !charges(current, productId, wanted)) {
    const created = await stripe.prices.create({
      product: productId,
      currency: CURRENCY,
      unit_amount: wanted.unitAmount,
      ...(wanted.interval && { recurring: { interval: wanted.interval } }),
      lookup_key: wanted.lookupKey,
      // Moves the key from the price this one replaces. Without one, the key is free: if another
      // run took it meanwhile, Stripe refuses, rather than this run taking it away.
      transfer_lookup_key: current !== undefined,
      nickname: wanted.nickname,
      metadata: wanted.metadata,
    });
    if (!current) return step("created", created.id);
    if (current.active) await stripe.prices.update(current.id, { active: false });
    return step("replaced", created.id, current.id);
  }

  if (
    current.active &&
    current.nickname === wanted.nickname &&
    hasMetadata(current.metadata, wanted.metadata)
  ) {
    return step("unchanged", current.id);
  }
  await stripe.prices.update(current.id, {
    active: true,
    nickname: wanted.nickname,
    metadata: wanted.metadata,
  });
  return step("updated", current.id);
}

/**
 * Creates or updates the products and prices in `catalog` (the membership catalog by default) and
 * returns what it did, calling `onStep` after each product and price. A failure stops the run
 * with what's done so far kept: run it again to finish.
 */
export async function syncMembershipPrices(options: {
  secretKey: string | undefined;
  /** For tests: a stand-in for Stripe's API (lib/stripe/fake-api.ts) as the HTTP client. */
  config?: Stripe.StripeConfig;
  catalog?: readonly CatalogProduct[];
  onStep?: (step: Step) => void;
}): Promise<Step[]> {
  const { catalog = MEMBERSHIP_CATALOG, onStep } = options;
  const stripe = new Stripe(testModeKey(options.secretKey), options.config);
  const steps: Step[] = [];
  const record = (step: Step) => {
    steps.push(step);
    onStep?.(step);
  };

  for (const product of catalog) {
    record(await syncProduct(stripe, product));
    const { data } = await stripe.prices.list({
      lookup_keys: product.prices.map((price) => price.lookupKey),
    });
    for (const wanted of product.prices) {
      const current = data.find((price) => price.lookup_key === wanted.lookupKey);
      record(await syncPrice(stripe, product.id, wanted, current));
    }
  }
  return steps;
}
