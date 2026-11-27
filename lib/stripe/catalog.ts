// The membership products and prices in Stripe (backlog M-3), made from the levels and yearly dues
// in sanity/schemas/options.ts, the one place they're written down. `pnpm stripe:prices`
// (scripts/stripe/setup-prices.mts) creates or updates them in Stripe test mode. Join (M-4) finds a
// level's price by its lookup key, and the webhook (M-5) can read the level and billing from a
// price's metadata.
//
// Each level is a product with two prices (docs/spec/architecture.md: offer one-time "pay for a
// year" as well as yearly auto-renew): a subscription that renews every year, and one year paid
// once. Both cost the level's dues.

// A relative path with its extension, so that the script can run this file with plain Node.
import { MEMBERSHIP_LEVELS, type MembershipLevel } from "../../sanity/schemas/options.ts";

/** How a member pays: a subscription that renews every year, or one year paid once. */
export const BILLING_OPTIONS = ["auto_renew", "one_time"] as const;
export type Billing = (typeof BILLING_OPTIONS)[number];

/** Every price is in US dollars. */
export const CURRENCY = "usd";

/** A level's product. The id is ours, not Stripe's, so the script finds the product by it. */
export function productId(level: MembershipLevel): string {
  return `membership_${level}`;
}

/**
 * The lookup key of a level's price for this billing: how the site finds the price to charge. When
 * the dues change, the key moves to the new price.
 */
export function priceLookupKey(level: MembershipLevel, billing: Billing): string {
  return `membership_${level}_${billing}`;
}

export interface CatalogPrice {
  lookupKey: string;
  /** In cents. */
  unitAmount: number;
  /** "year" for the price that renews; null for a one-time price. */
  interval: "year" | null;
  /** The price's name in the Stripe Dashboard. Members never see it. */
  nickname: string;
  metadata: { level: MembershipLevel; billing: Billing };
}

export interface CatalogProduct {
  id: string;
  /** What members see on Stripe Checkout, receipts and the Customer Portal. */
  name: string;
  metadata: { level: MembershipLevel };
  prices: CatalogPrice[];
}

/** The products and prices Stripe should have: one product per level, each with two prices. */
export const MEMBERSHIP_CATALOG: readonly CatalogProduct[] = MEMBERSHIP_LEVELS.map(
  ({ value: level, title, duesCents }) => ({
    id: productId(level),
    name: `${title} membership`,
    metadata: { level },
    prices: [
      {
        lookupKey: priceLookupKey(level, "auto_renew"),
        unitAmount: duesCents,
        interval: "year",
        nickname: `${title}, renews every year`,
        metadata: { level, billing: "auto_renew" },
      },
      {
        lookupKey: priceLookupKey(level, "one_time"),
        unitAmount: duesCents,
        interval: null,
        nickname: `${title}, one year paid once`,
        metadata: { level, billing: "one_time" },
      },
    ],
  }),
);
