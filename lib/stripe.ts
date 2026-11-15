import Stripe from "stripe";
import { requireEnv } from "./config";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) client = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}

export type Plan = "weekly" | "monthly";

export function priceIdFor(plan: Plan): string {
  return requireEnv(plan === "weekly" ? "STRIPE_PRICE_WEEKLY" : "STRIPE_PRICE_MONTHLY");
}

export function planForPrice(priceId: string | undefined | null): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_WEEKLY) return "weekly";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  return null;
}

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
