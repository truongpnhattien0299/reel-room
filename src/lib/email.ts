import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";

type Send = (msg: { from: string; to: string; subject: string; html: string }) => Promise<void>;

/**
 * Picks the provider from the env: EMAIL_PROVIDER if set, otherwise Resend
 * when RESEND_API_KEY is present, then SMTP when SMTP_HOST is. Null means
 * nothing is configured and emails are only printed.
 */
function createSender(): Send | null {
  const provider =
    process.env.EMAIL_PROVIDER ||
    (process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "");

  if (provider === "resend") {
    const resend = new Resend(process.env.RESEND_API_KEY);
    return async (msg) => {
      const { error } = await resend.emails.send(msg);
      if (error) throw new Error(`Failed to send email: ${error.message}`);
    };
  }

  if (provider === "smtp") {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 speaks TLS from the start; 587/25 upgrade with STARTTLS.
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return async (msg) => {
      await transport.sendMail(msg);
    };
  }

  if (provider) throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (use "resend" or "smtp")`);
  return null;
}

const send = createSender();

/** Resolves to false when no provider is configured and the email was only printed. */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!send) {
    // Dev fallback: no provider configured, print instead of sending.
    console.info(`\n[email] to=${to}\nsubject: ${subject}\n${html}\n`);
    return false;
  }
  await send({ from: process.env.EMAIL_FROM!, to, subject, html });
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
