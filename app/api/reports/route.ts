import { config } from "@/lib/config";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { seeOther, text } from "@/lib/http";

const KINDS = ["copyright", "intimate_image", "likeness", "other"];

/** Saves a removal request and emails the admins right away. No account needed to report. */
export async function POST(request: Request) {
  const form = await request.formData();
  if (text(form, "website")) return seeOther("/report?status=sent"); // hidden field: bots fill it, people do not

  const kind = text(form, "kind", 20);
  const videoUrl = text(form, "video_url", 500);
  const name = text(form, "name", 120);
  const email = text(form, "email", 254);
  const details = text(form, "details", 5000);
  const signature = text(form, "signature", 120);
  const goodFaith = form.get("good_faith") === "on";

  if (!KINDS.includes(kind) || !videoUrl || !name || !details || !signature || !goodFaith || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return seeOther("/report?status=missing");
  }

  const rows = await sql`
    insert into reports (kind, video_url, reporter_name, reporter_email, details, signature, good_faith)
    values (${kind}, ${videoUrl}, ${name}, ${email}, ${details}, ${signature}, ${goodFaith})
    returning id, created_at`;

  const urgent = kind === "intimate_image";
  const subject = urgent
    ? `URGENT (48-hour deadline): intimate image removal request`
    : `New ${kind} report on ${config.siteName}`;
  const body = `Kind: ${kind}\nReceived: ${rows[0].created_at}\nVideo: ${videoUrl}\nFrom: ${name} <${email}>\n\n${details}\n\nSigned: ${signature}\n\nReview it: ${config.siteUrl}/admin`;
  await Promise.allSettled(config.adminEmails.map((to) => sendEmail(to, subject, body)));
  await sendEmail(
    email,
    `We received your report (${config.siteName})`,
    `Thank you. We received your report about ${videoUrl} and will review it${urgent ? " within 48 hours" : " promptly"}.\n\nReference: ${rows[0].id}`,
  ).catch(() => {});

  return seeOther("/report?status=sent");
}
