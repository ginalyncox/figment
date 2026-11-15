import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/config";
import { sql } from "@/lib/db";
import { planForPrice, stripe } from "@/lib/stripe";

// Stripe calls this URL whenever something happens: a payment, a renewal,
// a cancellation, a refund, or a creator finishing payout setup.
// Add it in the Stripe dashboard for BOTH "Your account" and "Connected accounts".

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(payload, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  // Stripe may deliver the same event twice. Handle each one only once.
  const first = await sql`insert into processed_events (id) values (${event.id}) on conflict do nothing returning id`;
  if (first.length === 0) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (session.client_reference_id && customerId) {
          await sql`update users set stripe_customer_id = ${customerId}
                    where id = ${session.client_reference_id} and stripe_customer_id is null`;
        }
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) await syncSubscription(await stripe().subscriptions.retrieve(subId));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Always re-read from Stripe so an out-of-order event cannot overwrite newer state.
        await syncSubscription(await stripe().subscriptions.retrieve(event.data.object.id));
        break;

      case "charge.succeeded":
      case "charge.updated":
      case "charge.refunded":
        if (!event.account) await recordCharge(event.data.object.id); // platform charges only
        break;

      case "account.updated": {
        const account = event.data.object;
        await sql`update users set payouts_enabled = ${!!account.payouts_enabled}
                  where stripe_account_id = ${account.id}`;
        break;
      }
    }
  } catch (err) {
    // Let Stripe retry: forget that we saw this event, and report a failure.
    await sql`delete from processed_events where id = ${event.id}`;
    console.error("Stripe webhook failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  await sql`
    update users
    set sub_status = ${sub.status}, sub_plan = ${planForPrice(item?.price?.id)}, sub_period_end = ${periodEnd}
    where stripe_customer_id = ${customerId}`;
}

/** Saves what a charge brought in, its Stripe fee, and anything refunded. Safe to run many times. */
async function recordCharge(chargeId: string) {
  const charge = await stripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  if (!charge.paid || charge.status !== "succeeded") return;

  const bt = charge.balance_transaction;
  const fee = bt && typeof bt !== "string" ? bt.fee : 0;
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;

  await sql`
    insert into revenue (charge_id, stripe_customer_id, gross_cents, fee_cents, refunded_cents, created_at)
    values (${charge.id}, ${customerId}, ${charge.amount}, ${fee}, ${charge.amount_refunded}, ${new Date(charge.created * 1000).toISOString()})
    on conflict (charge_id) do update
      set fee_cents = greatest(revenue.fee_cents, excluded.fee_cents),
          refunded_cents = excluded.refunded_cents`;
}
