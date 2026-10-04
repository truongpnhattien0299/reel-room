import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { deleteObject, thumbKey } from "@/lib/r2";
import { withSession } from "@/server/route-utils";

/** Drops a cancelled or failed upload. Uppy aborts the multipart upload itself. */
export const DELETE = withSession(async (_req, session, ctx: RouteContext<"/api/uploads/[fileId]">) => {
  const { fileId } = await ctx.params;
  const [deleted] = await db
    .delete(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.uploadedBy, session.user.id),
        eq(files.status, "uploading"),
      ),
    )
    .returning({ r2Key: files.r2Key });
  if (deleted) {
    await Promise.allSettled([deleteObject(deleted.r2Key), deleteObject(thumbKey(fileId))]);
  }
  return new Response(null, { status: 204 });
});
