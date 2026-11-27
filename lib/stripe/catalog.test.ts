// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MEMBERSHIP_LEVELS } from "@/sanity/schemas/options";
import { MEMBERSHIP_CATALOG, priceLookupKey, productId } from "./catalog";

describe("the membership catalog", () => {
  it("charges the board's yearly dues for both of each level's prices", () => {
    // docs/spec/board-decisions.md §1, in cents.
    const board = { individual: 30_00, band: 50_00, business: 100_00, sponsor: 500_00 };
    expect(Object.fromEntries(MEMBERSHIP_LEVELS.map((l) => [l.value, l.duesCents]))).toEqual(board);
    expect(
      MEMBERSHIP_CATALOG.map(({ id, name, prices }) => ({
        id,
        name,
        prices: prices.map(({ lookupKey, unitAmount, interval }) => ({
          lookupKey,
          unitAmount,
          interval,
        })),
      })),
    ).toEqual(
      Object.entries(board).map(([level, dues]) => ({
        id: `membership_${level}`,
        name: `${level[0].toUpperCase()}${level.slice(1)} membership`,
        prices: [
          { lookupKey: `membership_${level}_auto_renew`, unitAmount: dues, interval: "year" },
          { lookupKey: `membership_${level}_one_time`, unitAmount: dues, interval: null },
        ],
      })),
    );
  });

  it("tags each product and price with its level and billing", () => {
    for (const product of MEMBERSHIP_CATALOG) {
      const level = product.metadata.level;
      expect(product.id).toBe(productId(level));
      expect(product.prices.map((price) => price.metadata)).toEqual([
        { level, billing: "auto_renew" },
        { level, billing: "one_time" },
      ]);
    }
  });

  it("keeps the ids and lookup keys that Stripe already has", () => {
    // The products and prices in Stripe are found by these. A new spelling would make
    // `pnpm stripe:prices` create a second set, and leave the site looking for prices that
    // don't exist yet.
    expect(productId("band")).toBe("membership_band");
    expect(priceLookupKey("band", "auto_renew")).toBe("membership_band_auto_renew");
    expect(priceLookupKey("band", "one_time")).toBe("membership_band_one_time");
    const keys = MEMBERSHIP_CATALOG.flatMap((product) => product.prices.map((p) => p.lookupKey));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
