import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, isSubscribed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const { subscribed: justSubscribed } = await searchParams;
  const subscribed = isSubscribed(user);
  const ends = user.sub_period_end ? new Date(user.sub_period_end).toLocaleDateString("en-US", { dateStyle: "long" }) : null;

  return (
    <>
      <h1>Your account</h1>
      <p className="muted">Signed in as {user.email}</p>

      {justSubscribed && !subscribed ? (
        <p className="notice" role="status">Thanks! Your payment is being confirmed. Refresh this page in a moment.</p>
      ) : null}

      <h2>Subscription</h2>
      {subscribed ? (
        <>
          <p>
            You are on the <strong>{user.sub_plan || "paid"}</strong> plan.
            {ends ? ` Your current period ends ${ends}.` : ""}
          </p>
          <form method="post" action="/api/portal">
            <button className="btn" type="submit">Manage or cancel subscription</button>
          </form>
          <p className="muted" style={{ marginTop: 8 }}>
            Canceling takes a couple of clicks. You keep access until the end of the period you paid for.
          </p>
        </>
      ) : (
        <>
          <p>You do not have an active subscription.</p>
          <div className="row">
            <Link className="btn" href="/subscribe">See plans</Link>
            {user.stripe_customer_id ? (
              <form method="post" action="/api/portal">
                <button className="btn secondary" type="submit">Billing history</button>
              </form>
            ) : null}
          </div>
        </>
      )}

      <h2>More</h2>
      <p className="row">
        <Link href="/creator">Creator dashboard</Link>
        {isAdmin(user) ? <Link href="/admin">Admin</Link> : null}
      </p>
      <form method="post" action="/api/auth/logout">
        <button className="btn secondary" type="submit">Sign out</button>
      </form>
    </>
  );
}
