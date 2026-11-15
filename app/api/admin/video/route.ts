import { currentUser, isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { seeOther, text } from "@/lib/http";

/** Approve a video, remove a video, or close a report. Admin only. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!isAdmin(user)) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const action = text(form, "action", 20);
  const id = text(form, "id", 36);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return seeOther("/admin");

  if (action === "approve") {
    await sql`update videos set status = 'published', published_at = now()
              where id = ${id} and status = 'pending_review'`;
  } else if (action === "remove") {
    const reason = text(form, "reason", 300) || "Removed by admin";
    await sql`update videos set status = 'removed', removed_reason = ${reason} where id = ${id}`;
  } else if (action === "report_removed" || action === "report_rejected") {
    await sql`update reports set status = ${action === "report_removed" ? "removed" : "rejected"}, resolved_at = now()
              where id = ${id}`;
  }
  return seeOther("/admin");
}
