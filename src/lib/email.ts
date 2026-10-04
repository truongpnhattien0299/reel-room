import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Resolves to false when no provider is configured and the email was only printed. */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    // Dev fallback: no provider configured, print instead of sending.
    console.info(`\n[email] to=${to}\nsubject: ${subject}\n${html}\n`);
    return false;
  }
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
  return true;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** For user-supplied text (names) placed in email bodies. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
