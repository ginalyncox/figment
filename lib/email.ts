import { Resend } from "resend";
import { config } from "./config";

/** Sends an email with Resend. With no RESEND_API_KEY (local dev) it prints to the console instead. */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n--- email (not sent: RESEND_API_KEY is not set) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }
  const from = process.env.EMAIL_FROM || `${config.siteName} <onboarding@resend.dev>`;
  const { error } = await new Resend(key).emails.send({ from, to, subject, text });
  if (error) throw new Error(`Email failed: ${error.message}`);
}
