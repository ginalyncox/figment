import { config } from "./config";
import { sql } from "./db";
import { computePayouts, type PayoutPlan } from "./payouts";
import { stripe } from "./stripe";

/** "2026-10-01" for any date in November 2026 (the last finished month, UTC). */
export function lastFinishedMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 10);
}

export function isFinishedMonth(month: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-01$/.test(month)) return false;
  const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return month < thisMonth;
}

function nextMonth(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/** Works out a month's split from the database. Changes nothing. */
export async function previewPayouts(month: string): Promise<PayoutPlan> {
  const end = nextMonth(month);
  const money = await sql`
    select coalesce(sum(gross_cents - fee_cents - refunded_cents), 0)::int as net
    from revenue where created_at >= ${month}::date and created_at < ${end}::date`;
  const watch = await sql`
    select v.creator_id, sum(w.seconds)::int as seconds
    from watch_time w join videos v on v.id = w.video_id
    where w.month = ${month}::date
    group by v.creator_id`;

  return computePayouts({
    netRevenueCents: money[0].net,
    feeBps: config.platformFeeBps,
    watch: watch.map((w) => ({ creatorId: w.creator_id, watchSeconds: w.seconds })),
  });
}

/**
 * Locks in a finished month's split (first run only) and sends the transfers.
 * Safe to run again: paid lines are skipped, and Stripe idempotency keys stop double payments.
 */
export async function runPayouts(month: string) {
  if (!isFinishedMonth(month)) throw new Error("Payouts can only run for a month that has ended.");

  const existing = await sql`select month from payout_runs where month = ${month}::date`;
  if (existing.length === 0) {
    const plan = await previewPayouts(month);
    await sql`
      insert into payout_runs (month, net_revenue_cents, platform_fee_cents, creator_pool_cents, total_watch_seconds)
      values (${month}::date, ${plan.netRevenueCents}, ${plan.platformFeeCents}, ${plan.creatorPoolCents}, ${plan.totalWatchSeconds})
      on conflict do nothing`;
    for (const line of plan.lines) {
      await sql`
        insert into payout_items (month, creator_id, watch_seconds, amount_cents)
        values (${month}::date, ${line.creatorId}, ${line.watchSeconds}, ${line.amountCents})
        on conflict do nothing`;
    }
  }

  const due = await sql`
    select p.creator_id, p.amount_cents, u.stripe_account_id, u.payouts_enabled
    from payout_items p join users u on u.id = p.creator_id
    where p.month = ${month}::date and p.status in ('pending','held','failed')`;

  const results = { paid: 0, held: 0, failed: 0 };
  for (const item of due) {
    if (item.amount_cents <= 0) {
      await sql`update payout_items set status = 'paid', note = 'Nothing to pay'
                where month = ${month}::date and creator_id = ${item.creator_id}`;
      continue;
    }
    if (!item.stripe_account_id || !item.payouts_enabled) {
      await sql`update payout_items set status = 'held', note = 'Creator has not finished Stripe payout setup'
                where month = ${month}::date and creator_id = ${item.creator_id}`;
      results.held += 1;
      continue;
    }
    try {
      const transfer = await stripe().transfers.create(
        {
          amount: item.amount_cents,
          currency: "usd",
          destination: item.stripe_account_id,
          transfer_group: `payout-${month}`,
          description: `Creator share for ${month.slice(0, 7)}`,
          metadata: { month, creator_id: item.creator_id },
        },
        { idempotencyKey: `payout-${month}-${item.creator_id}` },
      );
      await sql`update payout_items set status = 'paid', stripe_transfer_id = ${transfer.id}, note = null
                where month = ${month}::date and creator_id = ${item.creator_id}`;
      results.paid += 1;
    } catch (err) {
      const note = err instanceof Error ? err.message.slice(0, 300) : "Transfer failed";
      await sql`update payout_items set status = 'failed', note = ${note}
                where month = ${month}::date and creator_id = ${item.creator_id}`;
      results.failed += 1;
    }
  }
  return results;
}
