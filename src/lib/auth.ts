import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Internal app: accounts are created by admins (see /admin/users).
    disableSignUp: true,
    minPasswordLength: 8,
    // Invites reuse the reset-password flow, so give people a day to accept.
    resetPasswordTokenExpiresIn: 60 * 60 * 24,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Đặt mật khẩu Folder Studio",
        `<p>Chào ${user.name},</p>
         <p>Bấm vào link dưới đây để đặt mật khẩu cho tài khoản Folder Studio của bạn:</p>
         <p><a href="${url}">${url}</a></p>
         <p>Link hết hạn sau 24 giờ.</p>`,
      );
    },
  },
  plugins: [admin(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Current session for this request (deduped per render). */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/** Session or redirect to the login page. Use in pages, layouts and actions. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function isAdmin(session: Session) {
  return session.user.role === "admin";
}
