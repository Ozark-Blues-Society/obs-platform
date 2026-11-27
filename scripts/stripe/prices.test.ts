// @vitest-environment node
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { MEMBERSHIP_CATALOG, type CatalogProduct } from "../../lib/stripe/catalog.ts";
import { fakeStripe, type FakeRequest } from "../../lib/stripe/fake-api.ts";
import {
  describeStep,
  KeyRefusedError,
  summarize,
  syncMembershipPrices,
  testModeKey,
} from "./prices.mts";

const TEST_KEY = "sk_test_fake";

/** Runs the sync against `stripe`, a stand-in for Stripe's API. */
function run(stripe: ReturnType<typeof fakeStripe>, catalog?: readonly CatalogProduct[]) {
  return syncMembershipPrices({
    secretKey: TEST_KEY,
    config: { httpClient: Stripe.createFetchHttpClient(stripe.fetch), maxNetworkRetries: 0 },
    catalog,
  });
}

/** The prices that hold a lookup key, by key. */
function pricesByKey(stripe: ReturnType<typeof fakeStripe>) {
  return new Map(
    [...stripe.prices.values()].flatMap((price) =>
      price.lookup_key ? [[price.lookup_key, price] as const] : [],
    ),
  );
}

const writes = (requests: FakeRequest[]) => requests.filter((r) => r.method !== "GET");

describe("syncMembershipPrices", () => {
  it("creates a product per level with a yearly price and a one-time price at the board's dues", async () => {
    const stripe = fakeStripe();
    const steps = await run(stripe);

    expect(summarize(steps)).toBe("12 created, 0 updated, 0 replaced, 0 unchanged");
    expect(
      [...stripe.products.values()].map(({ id, name, active, metadata }) => [
        id,
        name,
        active,
        metadata,
      ]),
    ).toEqual([
      ["membership_individual", "Individual membership", true, { level: "individual" }],
      ["membership_band", "Band membership", true, { level: "band" }],
      ["membership_business", "Business membership", true, { level: "business" }],
      ["membership_sponsor", "Sponsor membership", true, { level: "sponsor" }],
    ]);
    // docs/spec/board-decisions.md §1: $30, $50, $100 and $500 a year.
    const dues = { individual: 3000, band: 5000, business: 10000, sponsor: 50000 };
    const byKey = pricesByKey(stripe);
    expect(byKey.size).toBe(8);
    for (const [level, amount] of Object.entries(dues)) {
      expect(byKey.get(`membership_${level}_auto_renew`)).toMatchObject({
        product: `membership_${level}`,
        active: true,
        currency: "usd",
        unit_amount: amount,
        type: "recurring",
        recurring: { interval: "year", interval_count: 1 },
        metadata: { level, billing: "auto_renew" },
      });
      expect(byKey.get(`membership_${level}_one_time`)).toMatchObject({
        product: `membership_${level}`,
        active: true,
        currency: "usd",
        unit_amount: amount,
        type: "one_time",
        recurring: null,
        metadata: { level, billing: "one_time" },
      });
    }
    expect(steps.slice(0, 3).map(describeStep)).toEqual([
      "created   product membership_individual: Individual membership",
      `created   price membership_individual_auto_renew: $30.00 a year, renews automatically (${byKey.get("membership_individual_auto_renew")?.id})`,
      `created   price membership_individual_one_time: $30.00 for one year, paid once (${byKey.get("membership_individual_one_time")?.id})`,
    ]);
  });

  it("changes nothing when run again", async () => {
    const stripe = fakeStripe();
    await run(stripe);
    const before = JSON.stringify([...stripe.products.values(), ...stripe.prices.values()]);
    const firstRun = stripe.requests.length;

    const steps = await run(stripe);

    expect(summarize(steps)).toBe("0 created, 0 updated, 0 replaced, 12 unchanged");
    expect(writes(stripe.requests.slice(firstRun))).toEqual([]);
    expect(JSON.stringify([...stripe.products.values(), ...stripe.prices.values()])).toBe(before);
  });

  it("puts back a product that was renamed, archived or retagged, keeping other metadata", async () => {
    const stripe = fakeStripe();
    await run(stripe);
    stripe.products.get("membership_band")!.name = "Band";
    stripe.products.get("membership_business")!.active = false;
    stripe.products.get("membership_sponsor")!.metadata.level = "business";
    stripe.products.get("membership_sponsor")!.metadata.note = "added in the Dashboard";

    const steps = await run(stripe);

    expect(summarize(steps)).toBe("0 created, 3 updated, 0 replaced, 9 unchanged");
    expect(steps.filter((step) => step.change === "updated").map((step) => step.key)).toEqual([
      "membership_band",
      "membership_business",
      "membership_sponsor",
    ]);
    expect(stripe.products.get("membership_band")?.name).toBe("Band membership");
    expect(stripe.products.get("membership_business")?.active).toBe(true);
    expect(stripe.products.get("membership_sponsor")?.metadata).toEqual({
      level: "sponsor",
      note: "added in the Dashboard",
    });
  });

  it("updates a price's nickname or metadata, and makes an archived price active, in place", async () => {
    const stripe = fakeStripe();
    await run(stripe);
    const before = pricesByKey(stripe);
    before.get("membership_band_auto_renew")!.nickname = "Old name";
    before.get("membership_business_one_time")!.metadata.billing = "auto_renew";
    before.get("membership_sponsor_one_time")!.active = false;

    const steps = await run(stripe);

    expect(summarize(steps)).toBe("0 created, 3 updated, 0 replaced, 9 unchanged");
    const after = pricesByKey(stripe);
    expect(after.get("membership_band_auto_renew")?.nickname).toBe("Band, renews every year");
    expect(after.get("membership_business_one_time")?.metadata).toEqual({
      level: "business",
      billing: "one_time",
    });
    expect(after.get("membership_sponsor_one_time")?.active).toBe(true);
    for (const [key, price] of before) expect(after.get(key)?.id).toBe(price.id);
    expect(stripe.prices.size).toBe(8);
  });

  it("replaces the prices when the dues change: the new price takes the lookup key, the old one is archived", async () => {
    const stripe = fakeStripe();
    await run(stripe);
    const old = pricesByKey(stripe);
    const newDues = MEMBERSHIP_CATALOG.map((product) =>
      product.id === "membership_band"
        ? { ...product, prices: product.prices.map((price) => ({ ...price, unitAmount: 6000 })) }
        : product,
    );

    const steps = await run(stripe, newDues);

    expect(summarize(steps)).toBe("0 created, 0 updated, 2 replaced, 10 unchanged");
    const now = pricesByKey(stripe);
    for (const key of ["membership_band_auto_renew", "membership_band_one_time"]) {
      const before = old.get(key)!;
      expect(now.get(key)).toMatchObject({
        unit_amount: 6000,
        active: true,
        product: "membership_band",
      });
      expect(now.get(key)?.id).not.toBe(before.id);
      expect(stripe.prices.get(before.id)).toMatchObject({
        unit_amount: 5000,
        active: false,
        lookup_key: null,
      });
      expect(steps.find((step) => step.key === key)).toMatchObject({
        change: "replaced",
        priceId: now.get(key)?.id,
        archivedPriceId: before.id,
      });
    }
    expect(describeStep(steps.find((step) => step.key === "membership_band_one_time")!)).toBe(
      `replaced  price membership_band_one_time: $60.00 for one year, paid once (${now.get("membership_band_one_time")?.id}; archived ${old.get("membership_band_one_time")?.id})`,
    );
    expect(summarize(await run(stripe, newDues))).toBe(
      "0 created, 0 updated, 0 replaced, 12 unchanged",
    );
  });

  it("replaces a price under the lookup key that bills the wrong way, in another currency or for another product", async () => {
    const stripe = fakeStripe();
    await run(stripe);
    const monthly = pricesByKey(stripe).get("membership_individual_auto_renew")!;
    monthly.recurring = { interval: "month", interval_count: 1, usage_type: "licensed" };
    const euros = pricesByKey(stripe).get("membership_band_one_time")!;
    euros.currency = "eur";
    const elsewhere = pricesByKey(stripe).get("membership_business_one_time")!;
    elsewhere.product = "membership_band";

    const steps = await run(stripe);

    expect(summarize(steps)).toBe("0 created, 0 updated, 3 replaced, 9 unchanged");
    const now = pricesByKey(stripe);
    expect(now.get("membership_individual_auto_renew")?.recurring).toMatchObject({
      interval: "year",
      interval_count: 1,
    });
    expect(now.get("membership_band_one_time")?.currency).toBe("usd");
    expect(now.get("membership_business_one_time")?.product).toBe("membership_business");
    expect([monthly.active, euros.active, elsewhere.active]).toEqual([false, false, false]);
  });

  it("stops at a failure, and a second run finishes the job without duplicates", async () => {
    const stripe = fakeStripe();
    stripe.failOnce(
      (request) =>
        request.method === "POST" &&
        request.path === "/v1/prices" &&
        request.params.lookup_key === "membership_business_one_time",
    );

    await expect(run(stripe)).rejects.toThrow("Something went wrong.");
    expect(stripe.prices.size).toBe(5);

    const steps = await run(stripe);

    // The business one-time price, then the sponsor product and its two prices.
    expect(summarize(steps)).toBe("4 created, 0 updated, 0 replaced, 8 unchanged");
    expect(stripe.products.size).toBe(4);
    expect(stripe.prices.size).toBe(8);
    expect(pricesByKey(stripe).size).toBe(8);
  });

  it("refuses a live key, or anything but a test key, before sending a request", async () => {
    const stripe = fakeStripe();
    const refused = [
      [undefined, "isn't set"],
      ["  ", "isn't set"],
      ["sk_live_abc", "is a live-mode key"],
      ["rk_live_abc", "is a live-mode key"],
      ["sk_org_abc", "isn't a Stripe test-mode secret key"],
      ["pk_test_abc", "isn't a Stripe test-mode secret key"],
      ["whsec_abc", "isn't a Stripe test-mode secret key"],
    ] as const;
    for (const [secretKey, message] of refused) {
      const result = syncMembershipPrices({
        secretKey,
        config: { httpClient: Stripe.createFetchHttpClient(stripe.fetch), maxNetworkRetries: 0 },
      });
      await expect(result).rejects.toThrow(KeyRefusedError);
      await expect(result).rejects.toThrow(message);
    }
    expect(stripe.requests).toEqual([]);

    expect(testModeKey(" sk_test_abc\n")).toBe("sk_test_abc");
    expect(testModeKey("rk_test_abc")).toBe("rk_test_abc");
  });
});
