import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { deleteObject, thumbKey } from "@/lib/r2";

/**
 * Daily (see vercel.json): drop uploads that never completed. Incomplete
 * multipart parts are removed by the R2 lifecycle rule, not here.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await db
    .delete(files)
    .where(and(eq(files.status, "uploading"), lt(files.createdAt, cutoff)))
    .returning({ id: files.id, r2Key: files.r2Key });
  await Promise.allSettled(
    stale.flatMap((f) => [deleteObject(f.r2Key), deleteObject(thumbKey(f.id))]),
  );
  return Response.json({ removed: stale.length });
}
