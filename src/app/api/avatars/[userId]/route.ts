import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { presignRead } from "@/lib/r2";
import { redirectToSigned } from "@/server/file-access";
import { NotFoundError } from "@/server/permissions";
import { withSession } from "@/server/route-utils";

/** Any signed-in user may see anyone's avatar. */
export const GET = withSession(async (_req, _session, ctx: RouteContext<"/api/avatars/[userId]">) => {
  const { userId } = await ctx.params;
  const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId));
  if (!row?.image?.startsWith("avatars/")) throw new NotFoundError("No avatar");
  return redirectToSigned(await presignRead(row.image, { contentType: "image/webp" }));
});
