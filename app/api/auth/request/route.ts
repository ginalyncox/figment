import { createLoginToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { safeNext, seeOther, text } from "@/lib/http";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = text(form, "email", 254).toLowerCase();
  const next = safeNext(form.get("next"));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return seeOther(`/login?status=invalid&next=${encodeURIComponent(next)}`);
  }

  const token = await createLoginToken(email);
  const link = `${config.siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  await sendEmail(
    email,
    `Your sign-in link for ${config.siteName}`,
    `Open this link to sign in. It works for 15 minutes.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
  );

  // Same message whether or not the email has an account, so nobody can probe for accounts.
  return seeOther(`/login?status=sent&next=${encodeURIComponent(next)}`);
}
