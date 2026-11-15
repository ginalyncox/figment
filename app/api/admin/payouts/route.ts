import { currentUser, isAdmin } from "@/lib/auth";
import { seeOther, text } from "@/lib/http";
import { isFinishedMonth, runPayouts } from "@/lib/payoutRun";

/** Sends real money. Only an admin can press this, and only for a month that has ended. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!isAdmin(user)) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const month = text(form, "month", 10);
  if (form.get("confirm") !== "on" || !isFinishedMonth(month)) return seeOther("/admin?payout=notconfirmed");

  const r = await runPayouts(month);
  return seeOther(`/admin?payout=done&paid=${r.paid}&held=${r.held}&failed=${r.failed}`);
}
