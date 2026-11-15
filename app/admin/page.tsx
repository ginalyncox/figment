import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { lastFinishedMonth, previewPayouts } from "@/lib/payoutRun";
import { formatMoney } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const kindWords: Record<string, string> = {
  copyright: "Copyright",
  intimate_image: "INTIMATE IMAGE (48-hour deadline)",
  likeness: "Likeness",
  other: "Other",
};

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ payout?: string; paid?: string; held?: string; failed?: string }>;
}) {
  const user = await currentUser();
  if (!isAdmin(user)) notFound();
  const q = await searchParams;

  const pending = await sql`
    select v.id, v.title, v.ai_tools, v.created_at, u.display_name, u.email
    from videos v join users u on u.id = v.creator_id
    where v.status = 'pending_review' order by v.created_at`;
  const reports = await sql`select * from reports where status = 'open' order by (kind = 'intimate_image') desc, created_at`;

  const month = lastFinishedMonth();
  const monthLabel = new Date(month).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const plan = await previewPayouts(month);
  const run = await sql`select * from payout_runs where month = ${month}::date`;
  const items = await sql`
    select p.*, u.display_name from payout_items p join users u on u.id = p.creator_id
    where p.month = ${month}::date order by p.amount_cents desc`;
  const names = await sql`select id, display_name from users where is_creator`;
  const nameOf = (id: string) => names.find((n) => n.id === id)?.display_name || id.slice(0, 8);

  return (
    <>
      <h1>Admin</h1>

      <h2>Open reports ({reports.length})</h2>
      {reports.length === 0 ? <p className="muted">No open reports.</p> : reports.map((r) => (
        <div className="card" key={r.id} style={{ marginBottom: 12 }}>
          <h3>{kindWords[r.kind]}</h3>
          <p className="muted">
            Received {new Date(r.created_at).toLocaleString("en-US")} · from {r.reporter_name} ({r.reporter_email})
          </p>
          <p>Video: <a href={r.video_url}>{r.video_url}</a></p>
          <p>{r.details}</p>
          <p className="muted">Signed: {r.signature}</p>
          <div className="row">
            <form method="post" action="/api/admin/video">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="report_removed" />
              <button className="btn secondary" type="submit">Mark: video removed</button>
            </form>
            <form method="post" action="/api/admin/video">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="report_rejected" />
              <button className="btn secondary" type="submit">Mark: no action</button>
            </form>
          </div>
          <p className="muted">Remove the video itself from “Videos waiting” below or its watch page id.</p>
        </div>
      ))}

      <h2>Videos waiting for review ({pending.length})</h2>
      {pending.length === 0 ? <p className="muted">Nothing waiting.</p> : pending.map((v) => (
        <div className="card" key={v.id} style={{ marginBottom: 12 }}>
          <h3><Link href={`/watch/${v.id}`} prefetch={false}>{v.title}</Link></h3>
          <p className="muted">By {v.display_name} ({v.email}) · AI tools: {v.ai_tools || "not stated"}</p>
          <div className="row">
            <form method="post" action="/api/admin/video">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="action" value="approve" />
              <button className="btn" type="submit">Approve and publish</button>
            </form>
            <form method="post" action="/api/admin/video" className="row">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="action" value="remove" />
              <input type="text" name="reason" placeholder="Reason" aria-label="Reason for removal" style={{ width: 200 }} />
              <button className="btn danger" type="submit">Reject</button>
            </form>
          </div>
        </div>
      ))}

      <h2>Remove a live video</h2>
      <form method="post" action="/api/admin/video" className="stack">
        <input type="hidden" name="action" value="remove" />
        <label>Video id (the long code at the end of its watch link)<input type="text" name="id" required /></label>
        <label>Reason<input type="text" name="reason" /></label>
        <button className="btn danger" type="submit">Remove video</button>
      </form>

      <h2>Creator payouts for {monthLabel}</h2>
      {q.payout === "done" ? (
        <p className="notice" role="status">Payout run finished. Paid: {q.paid}. Held: {q.held}. Failed: {q.failed}.</p>
      ) : null}
      {q.payout === "notconfirmed" ? <p className="error" role="alert">Tick the confirm box to send payouts.</p> : null}

      {run.length > 0 ? (
        <>
          <p>
            This month is locked in. Net revenue {formatMoney(run[0].net_revenue_cents)} · your fee{" "}
            {formatMoney(run[0].platform_fee_cents)} · creator pool {formatMoney(run[0].creator_pool_cents)}.
          </p>
          <table>
            <thead><tr><th>Creator</th><th>Amount</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.creator_id}>
                  <td>{i.display_name}</td><td>{formatMoney(i.amount_cents)}</td><td>{i.status}</td><td>{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <p>
            Preview (nothing sent yet). Net revenue {formatMoney(plan.netRevenueCents)} · your fee{" "}
            {formatMoney(plan.platformFeeCents)} · creator pool {formatMoney(plan.creatorPoolCents)}.
          </p>
          {plan.lines.length === 0 ? <p className="muted">No watch time recorded, so there is nothing to pay out.</p> : (
            <table>
              <thead><tr><th>Creator</th><th>Minutes watched</th><th>Amount</th></tr></thead>
              <tbody>
                {plan.lines.map((l) => (
                  <tr key={l.creatorId}>
                    <td>{nameOf(l.creatorId)}</td><td>{Math.round(l.watchSeconds / 60)}</td><td>{formatMoney(l.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      <form method="post" action="/api/admin/payouts" className="stack" style={{ marginTop: 12 }}>
        <input type="hidden" name="month" value={month} />
        <label className="check">
          <input type="checkbox" name="confirm" required />
          <span>I checked the numbers and my Stripe balance covers the creator pool. Send real money.</span>
        </label>
        <button className="btn" type="submit">{run.length > 0 ? "Retry unpaid lines" : `Send ${monthLabel} payouts`}</button>
      </form>
    </>
  );
}
