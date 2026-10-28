import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { z } from "zod";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const linkPasswordSchema = z
  .string()
  .min(4, "Mật khẩu tối thiểu 4 ký tự")
  .max(128, "Mật khẩu tối đa 128 ký tự");

/** Wrong passwords in a row before the link refuses all tries for `LOCK_MINUTES`. */
export const MAX_ATTEMPTS = 10;
export const LOCK_MINUTES = 15;
/** How long a visitor stays unlocked (less if the link expires sooner). */
const UNLOCK_DAYS = 7;

/** `salt:hash`, both base64. */
export async function hashLinkPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyLinkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

type LockedLink = { id: string; passwordHash: string | null; expiresAt: Date | null };

const cookieName = (linkId: string) => `rr_link_${linkId}`;

/**
 * Proof the visitor typed this link's password. The hash is part of the
 * message, so changing or removing the password voids every cookie handed out.
 */
function unlockToken(link: LockedLink) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${link.id}${link.passwordHash}`).digest("base64url");
}

/** Whether this request carries a valid unlock cookie (always true without a password). */
export async function isUnlocked(link: LockedLink) {
  if (!link.passwordHash) return true;
  const value = (await cookies()).get(cookieName(link.id))?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(unlockToken(link));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Server functions and route handlers only (cookies can't be set while rendering). */
export async function setUnlockCookie(link: LockedLink) {
  const max = new Date(Date.now() + UNLOCK_DAYS * 86_400_000);
  (await cookies()).set(cookieName(link.id), unlockToken(link), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: link.expiresAt && link.expiresAt < max ? link.expiresAt : max,
  });
}
