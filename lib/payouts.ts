// Creator pay math. No database or Stripe calls in here, so it is easy to test.
// All money is in whole cents. Nothing is ever created or lost to rounding.

export type CreatorWatch = { creatorId: string; watchSeconds: number };

export type PayoutLine = { creatorId: string; watchSeconds: number; amountCents: number };

export type PayoutPlan = {
  netRevenueCents: number;
  platformFeeCents: number;
  creatorPoolCents: number;
  totalWatchSeconds: number;
  /** Cents not handed out (only when nobody watched anything). Stays with the platform balance. */
  undistributedCents: number;
  lines: PayoutLine[];
};

/**
 * Split one month's money.
 *
 *   net revenue      = what subscribers paid - Stripe fees - refunds
 *   platform fee     = net revenue x feeBps / 10000   (rounded to the nearest cent)
 *   creator pool     = net revenue - platform fee
 *   a creator's pay  = creator pool x (their watch seconds / all watch seconds)
 *
 * Shares are rounded down, then leftover cents go one at a time to the creators
 * with the largest remainders, so the lines always add up to the pool exactly.
 */
export function computePayouts(input: {
  netRevenueCents: number;
  feeBps: number;
  watch: CreatorWatch[];
}): PayoutPlan {
  const { feeBps } = input;
  if (!Number.isInteger(input.netRevenueCents)) throw new Error("netRevenueCents must be whole cents");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) throw new Error("feeBps must be 0-10000");

  // A month with more refunds than sales pays nobody.
  const net = Math.max(0, input.netRevenueCents);
  const platformFeeCents = Math.round((net * feeBps) / 10000);
  const creatorPoolCents = net - platformFeeCents;

  const watch = input.watch.filter((w) => w.watchSeconds > 0);
  for (const w of watch) {
    if (!Number.isInteger(w.watchSeconds)) throw new Error("watchSeconds must be whole seconds");
  }
  const totalWatchSeconds = watch.reduce((sum, w) => sum + w.watchSeconds, 0);

  if (totalWatchSeconds === 0 || creatorPoolCents === 0) {
    return {
      netRevenueCents: net,
      platformFeeCents,
      creatorPoolCents,
      totalWatchSeconds,
      undistributedCents: creatorPoolCents,
      lines: [],
    };
  }

  // BigInt keeps the multiplication exact even for very large numbers.
  const pool = BigInt(creatorPoolCents);
  const total = BigInt(totalWatchSeconds);
  const working = watch.map((w) => {
    const product = pool * BigInt(w.watchSeconds);
    return {
      creatorId: w.creatorId,
      watchSeconds: w.watchSeconds,
      amountCents: Number(product / total),
      remainder: product % total,
    };
  });

  let leftover = creatorPoolCents - working.reduce((sum, w) => sum + w.amountCents, 0);
  const byRemainder = [...working].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.creatorId < b.creatorId ? -1 : 1; // stable tie-break
  });
  for (const w of byRemainder) {
    if (leftover <= 0) break;
    w.amountCents += 1;
    leftover -= 1;
  }

  return {
    netRevenueCents: net,
    platformFeeCents,
    creatorPoolCents,
    totalWatchSeconds,
    undistributedCents: 0,
    lines: working
      .map(({ creatorId, watchSeconds, amountCents }) => ({ creatorId, watchSeconds, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents || (a.creatorId < b.creatorId ? -1 : 1)),
  };
}
