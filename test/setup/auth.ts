import type { Session } from "@/lib/auth";

/**
 * Stand-in for `@/lib/auth`: no Better Auth, just whichever session the test
 * signed in with `signIn`.
 */
let current: Session | null = null;

export function signIn(session: Session | null) {
  current = session;
}

export const auth = {};

export async function getSession() {
  return current;
}

export async function requireSession() {
  if (!current) throw new Error("requireSession() called with no signed-in test user");
  return current;
}

export function isAdmin(session: Session) {
  return session.user.role === "admin";
}
