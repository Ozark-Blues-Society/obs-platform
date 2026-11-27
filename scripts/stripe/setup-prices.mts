/**
 * `pnpm stripe:prices`: creates or updates the membership products and prices in Stripe test mode
 * (backlog M-3), from the levels and yearly dues in sanity/schemas/options.ts. It reads
 * STRIPE_SECRET_KEY from .env.local or the shell and refuses a live-mode key. A second run changes
 * nothing. Exit codes: 0 done, 1 refused or stopped. See ./prices.mts.
 */
import { describeStep, KeyRefusedError, summarize, syncMembershipPrices } from "./prices.mts";

try {
  const steps = await syncMembershipPrices({
    secretKey: process.env.STRIPE_SECRET_KEY,
    onStep: (step) => console.log(describeStep(step)),
  });
  console.log(`Done, in Stripe test mode: ${summarize(steps)}.`);
} catch (error) {
  console.error(
    error instanceof KeyRefusedError
      ? error.message
      : `Stopped: ${error instanceof Error ? error.message : String(error)}\nWhat's done is kept. Run it again to finish.`,
  );
  process.exit(1);
}
