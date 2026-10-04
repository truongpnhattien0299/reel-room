import "server-only";
import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { invitations, user, type Invitation } from "@/db/schema";
import { escapeHtml, sendEmail } from "@/lib/email";
import { invitePath } from "@/lib/media";

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export const INVITE_TTL_DAYS = 7;

/** 192 random bits, URL-safe. */
export const newInviteToken = () => randomBytes(24).toString("base64url");

export type ResolvedInvitation =
  | { status: "ok"; invitation: Invitation }
  | { status: "expired" }
  | { status: "registered" }
  | { status: "invalid" };

/** Looks up an invite link; it works once, until it expires. */
export const resolveInvitation = cache(async (token: string): Promise<ResolvedInvitation> => {
  if (!TOKEN.test(token)) return { status: "invalid" };
  const [row] = await db
    .select({ invitation: invitations, existingUserId: user.id })
    .from(invitations)
    .leftJoin(user, eq(user.email, invitations.email))
    .where(eq(invitations.token, token));
  if (!row) return { status: "invalid" };
  if (row.existingUserId) return { status: "registered" };
  if (row.invitation.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  return { status: "ok", invitation: row.invitation };
});

export async function listInvitations() {
  return db
    .select({
      id: invitations.id,
      token: invitations.token,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      invitedByName: user.name,
    })
    .from(invitations)
    .leftJoin(user, eq(user.id, invitations.invitedBy))
    .orderBy(asc(invitations.email));
}

export type InvitationItem = Awaited<ReturnType<typeof listInvitations>>[number];

/** True when the email actually went out (false: no provider, or it failed). */
export async function sendInviteEmail(email: string, token: string, inviterName: string) {
  const url = `${process.env.BETTER_AUTH_URL}${invitePath(token)}`;
  try {
    return await sendEmail(
      email,
      `${inviterName} mời bạn vào ReelRoom`,
      `<p>${escapeHtml(inviterName)} mời bạn tham gia ReelRoom.</p>
       <p>Bấm vào link dưới đây, nhập tên và mật khẩu để tạo tài khoản:</p>
       <p><a href="${url}">${url}</a></p>
       <p>Link dùng được một lần và hết hạn sau ${INVITE_TTL_DAYS} ngày.</p>`,
    );
  } catch (err) {
    // The admin still gets the link in the dialog and can pass it on.
    console.error(err);
    return false;
  }
}
