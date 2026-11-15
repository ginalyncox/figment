import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { formatMoney } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const statusWords: Record<string, string> = {
  uploading: "Waiting for file",
  processing: "Processing",
  pending_review: "Waiting for review",
  published: "Live",
  removed: "Removed",
};

export default async function Creator({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; stripe?: string }>;
}) {
  const { error, stripe: stripeStatus } = await searchParams;
  const user = await currentUser();
  const feePercent = config.platformFeeBps / 100;

  const pitch = (
    <>
      <h1>Earn from your AI videos</h1>
      <p>
        Upload your AI-made videos. Subscribers pay weekly or monthly. Each month, subscription money
        (after payment fees and refunds) is split: {feePercent}% service fee, and the rest shared among
        creators by how much paying subscribers watched their videos. You keep ownership of your work.
      </p>
    </>
  );

  if (!user) {
    return (
      <>
        {pitch}
        <Link className="btn" href="/login?next=/creator">Sign in to start</Link>
      </>
    );
  }

  if (!user.license_version) {
    return (
      <>
        {pitch}
        <h2>Step 1: accept the license</h2>
        {error === "agree" ? <p className="error" role="alert">Please add a display name and tick both boxes.</p> : null}
        <form className="stack" method="post" action="/api/creator/join">
          <label>
            Creator display name
            <input type="text" name="display_name" maxLength={60} required />
          </label>
          <label className="check">
            <input type="checkbox" name="adult" required />
            <span>I am 18 or older.</span>
          </label>
          <label className="check">
            <input type="checkbox" name="agree" required />
            <span>
              I have read and agree to the{" "}
              <Link href="/legal/creator-license" target="_blank">Creator License Agreement</Link> and the{" "}
              <Link href="/legal/terms" target="_blank">Terms of Service</Link>.
            </span>
          </label>
          <button className="btn" type="submit">Agree and set up payouts</button>
        </form>
      </>
    );
  }

  const videos = await sql`
    select id, title, status, created_at from videos where creator_id = ${user.id} order by created_at desc`;
  const payouts = await sql`
    select month, watch_seconds, amount_cents, status from payout_items
    where creator_id = ${user.id} order by month desc limit 12`;

  return (
    <>
      <h1>Creator dashboard</h1>
      <p className="muted">Creating as {user.display_name}</p>

      {!user.payouts_enabled ? (
        <div className="notice">
          <p>
            <strong>Payouts are not set up yet.</strong> Stripe needs to confirm your identity and bank
            details before you can be paid. {stripeStatus === "done" ? "If you just finished, this can take a few minutes to update." : ""}
          </p>
          <form method="post" action="/api/creator/join">
            <button className="btn" type="submit">{user.stripe_account_id ? "Continue payout setup" : "Set up payouts"}</button>
          </form>
        </div>
      ) : (
        <p className="notice" role="status">Payouts are set up.</p>
      )}

      <h2>Upload a video</h2>
      <UploadForm />

      <h2>Your videos</h2>
      {videos.length === 0 ? <p className="muted">Nothing uploaded yet.</p> : (
        <table>
          <thead><tr><th>Title</th><th>Status</th></tr></thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td>{v.status === "removed" ? v.title : <Link href={`/watch/${v.id}`} prefetch={false}>{v.title}</Link>}</td>
                <td>{statusWords[v.status] || v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Your payouts</h2>
      {payouts.length === 0 ? <p className="muted">No payouts yet. Payouts are worked out after each month ends.</p> : (
        <table>
          <thead><tr><th>Month</th><th>Minutes watched</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={String(p.month)}>
                <td>{new Date(p.month).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</td>
                <td>{Math.round(Number(p.watch_seconds) / 60)}</td>
                <td>{formatMoney(p.amount_cents)}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
