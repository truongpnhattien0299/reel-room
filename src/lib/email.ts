import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    // Dev fallback: no provider configured, print instead of sending.
    console.info(`\n[email] to=${to}\nsubject: ${subject}\n${html}\n`);
    return;
  }
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
