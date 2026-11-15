import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { seeOther } from "@/lib/http";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

/** Sends the viewer to Stripe's billing page, where they can cancel or change plan in a couple of clicks. */
export async function POST() {
  const user = await currentUser();
  if (!user) return seeOther("/login?next=/account");
  if (!user.stripe_customer_id) return seeOther("/subscribe");

  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${config.siteUrl}/account`,
  });
  return NextResponse.redirect(session.url, 303);
}
