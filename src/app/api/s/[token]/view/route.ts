import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getUserRole } from "@/server/permissions";
import { resolveShareLink } from "@/server/share-links";

/**
 * Counts a visit to a public link, sent once by the page (a server component
 * can't set the cookie). Each browser counts at most once a day; members of
 * the folder checking their own link don't count.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/s/[token]/view">) {
  const { token } = await ctx.params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return Response.json({ error: "Link không còn hiệu lực" }, { status: 404 });
  const { link, root } = resolved;

  const jar = await cookies();
  const seen = `rr_seen_${link.id}`;
  if (jar.has(seen)) return new Response(null, { status: 204 });
  const session = await getSession();
  if (session && (await getUserRole(session.user, root))) return new Response(null, { status: 204 });

  await db
    .update(shareLinks)
    .set({ viewCount: sql`${shareLinks.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(shareLinks.id, link.id));
  jar.set(seen, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
  return new Response(null, { status: 204 });
}
