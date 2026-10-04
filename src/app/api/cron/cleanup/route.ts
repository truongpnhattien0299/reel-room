import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { files, folders, invitations, shareLinks } from "@/db/schema";
import { deleteObject, thumbKey } from "@/lib/r2";
import { purgeFiles, purgeFolderTree } from "@/server/purge";
import { TRASH_RETENTION_DAYS } from "@/server/queries";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily (see vercel.json):
 * - drop uploads that never completed (incomplete multipart parts are
 *   removed by the R2 lifecycle rule, not here);
 * - permanently delete what has sat in the trash past the retention period;
 * - drop share links expired for a while (kept a bit so visitors are told
 *   "expired" rather than "invalid"), and likewise unused invites.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stale = await db
    .delete(files)
    .where(and(eq(files.status, "uploading"), lt(files.createdAt, new Date(Date.now() - DAY))))
    .returning({ id: files.id, r2Key: files.r2Key });
  await Promise.allSettled(
    stale.flatMap((f) => [deleteObject(f.r2Key), deleteObject(thumbKey(f.id))]),
  );

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * DAY);

  // Folders trashed directly (not as part of a parent): purge each subtree.
  const parent = alias(folders, "parent");
  const expiredFolders = await db
    .select({ path: folders.path })
    .from(folders)
    .leftJoin(parent, eq(parent.id, folders.parentId))
    .where(
      and(
        isNotNull(folders.deletedAt),
        lt(folders.deletedAt, cutoff),
        or(isNull(parent.id), isNull(parent.deletedAt)),
      ),
    );
  let purgedFiles = 0;
  for (const f of expiredFolders) purgedFiles += await purgeFolderTree(f.path);

  // Files trashed on their own.
  const expiredFiles = await db
    .select({ id: files.id })
    .from(files)
    .where(and(isNotNull(files.deletedAt), lt(files.deletedAt, cutoff)));
  purgedFiles += await purgeFiles(expiredFiles.map((f) => f.id));

  const expiredLinks = await db
    .delete(shareLinks)
    .where(lt(shareLinks.expiresAt, cutoff))
    .returning({ id: shareLinks.id });

  const expiredInvites = await db
    .delete(invitations)
    .where(lt(invitations.expiresAt, cutoff))
    .returning({ id: invitations.id });

  return Response.json({
    abandonedUploads: stale.length,
    expiredInvites: expiredInvites.length,
    expiredLinks: expiredLinks.length,
    purgedFolders: expiredFolders.length,
    purgedFiles,
  });
}
