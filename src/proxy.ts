import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: redirects visitors without a session cookie.
// Every page, action and route handler still validates the session itself.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // s/: public share links, viewable without an account. invite/: sign-up from an invite.
    "/((?!api|login|reset-password|invite/|s/|_next/static|_next/image|favicon.ico).*)",
  ],
};
