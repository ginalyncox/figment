import Link from "next/link";
import { currentUser, isSubscribed } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatMoney, priceIdFor, stripe, type Plan } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function loadPrice(plan: Plan): Promise<string | null> {
  try {
    const price = await stripe().prices.retrieve(priceIdFor(plan));
    if (price.unit_amount == null) return null;
    return formatMoney(price.unit_amount, price.currency);
  } catch {
    return null;
  }
}

export default async function Subscribe({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const user = await currentUser();
  const [weekly, monthly] = await Promise.all([loadPrice("weekly"), loadPrice("monthly")]);

  if (isSubscribed(user)) {
    return (
      <>
        <h1>You are subscribed</h1>
        <p>You can watch every video. Manage or cancel your plan on your <Link href="/account">account page</Link>.</p>
      </>
    );
  }

  const plans: { plan: Plan; name: string; price: string | null; per: string }[] = [
    { plan: "weekly", name: "Weekly", price: weekly, per: "week" },
    { plan: "monthly", name: "Monthly", price: monthly, per: "month" },
  ];

  return (
    <>
      <h1>Subscribe</h1>
      <p>
        Your first {config.freeVideoLimit} videos are free. A subscription unlocks every video.
        Most of what you pay goes to the creators you watch.
      </p>
      {canceled ? <p className="notice" role="status">Checkout was canceled. You have not been charged.</p> : null}

      <div className="plans">
        {plans.map((p) => (
          <section className="card" key={p.plan} aria-label={`${p.name} plan`}>
            <h2>{p.name}</h2>
            {p.price ? (
              <>
                <p className="price">{p.price} <span className="muted" style={{ fontSize: "1rem" }}>per {p.per}</span></p>
                {/* Renewal terms sit right next to the button, before any payment. */}
                <p>
                  Renews automatically every {p.per} at {p.price} until you cancel.
                  Cancel online any time on your account page.
                </p>
                {user ? (
                  <form method="post" action="/api/checkout">
                    <input type="hidden" name="plan" value={p.plan} />
                    <button className="btn" type="submit">Subscribe {p.name.toLowerCase()}</button>
                  </form>
                ) : (
                  <Link className="btn" href="/login?next=/subscribe">Sign in to subscribe</Link>
                )}
              </>
            ) : (
              <p className="muted">This plan is not set up yet.</p>
            )}
          </section>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        By subscribing you agree to the <Link href="/legal/terms">Terms of Service</Link>. You must be 18 or older.
      </p>
    </>
  );
}
