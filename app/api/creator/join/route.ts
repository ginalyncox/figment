import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { seeOther, text } from "@/lib/http";
import { stripe } from "@/lib/stripe";

/**
 * Step 1: the creator accepts the Creator License Agreement (we save which version, when, and from where).
 * Step 2: we send them to Stripe to set up payouts. Stripe checks identity and collects tax details.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return seeOther("/login?next=/creator");

  const form = await request.formData();

  if (!user.license_version) {
    const agreed = form.get("agree") === "on" && form.get("adult") === "on";
    const displayName = text(form, "display_name", 60);
    if (!agreed || !displayName) return seeOther("/creator?error=agree");
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await sql`
      update users
      set is_creator = true, display_name = ${displayName},
          license_version = ${config.licenseVersion}, license_accepted_at = now(), license_accepted_ip = ${ip}
      where id = ${user.id}`;
  }

  let accountId = user.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create(
      {
        type: "express",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: user.id },
      },
      { idempotencyKey: `connect-${user.id}` },
    );
    accountId = account.id;
    await sql`update users set stripe_account_id = ${accountId} where id = ${user.id} and stripe_account_id is null`;
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${config.siteUrl}/creator?stripe=retry`,
    return_url: `${config.siteUrl}/creator?stripe=done`,
  });
  return NextResponse.redirect(link.url, 303);
}
