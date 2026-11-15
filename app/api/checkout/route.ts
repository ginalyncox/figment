import { currentUser, isSubscribed } from "@/lib/auth";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { seeOther, text } from "@/lib/http";
import { formatMoney, priceIdFor, stripe, type Plan } from "@/lib/stripe";
import { NextResponse } from "next/server";

/** Starts a Stripe Checkout page for a weekly or monthly subscription. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return seeOther("/login?next=/subscribe");
  if (isSubscribed(user)) return seeOther("/account"); // never start a second subscription

  const form = await request.formData();
  const plan = text(form, "plan") as Plan;
  if (plan !== "weekly" && plan !== "monthly") return seeOther("/subscribe");

  // One Stripe customer per account, created once.
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe().customers.create(
      { email: user.email, metadata: { user_id: user.id } },
      { idempotencyKey: `customer-${user.id}` },
    );
    customerId = customer.id;
    await sql`update users set stripe_customer_id = ${customerId} where id = ${user.id} and stripe_customer_id is null`;
  }

  const price = await stripe().prices.retrieve(priceIdFor(plan));
  const amount = price.unit_amount != null ? formatMoney(price.unit_amount, price.currency) : "the price shown";
  const per = plan === "weekly" ? "week" : "month";

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: price.id, quantity: 1 }],
    // The renewal terms are repeated on the payment page itself, above the pay button.
    custom_text: {
      submit: {
        message: `You will be charged ${amount} every ${per} until you cancel. Cancel online any time on your account page.`,
      },
    },
    success_url: `${config.siteUrl}/account?subscribed=1`,
    cancel_url: `${config.siteUrl}/subscribe?canceled=1`,
  });

  if (!session.url) return seeOther("/subscribe");
  return NextResponse.redirect(session.url, 303);
}
