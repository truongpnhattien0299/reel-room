import "server-only";
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { deleteObject } from "@/lib/r2";
import { logActivity, someNames } from "@/server/activity";

type StoredFile = { id: string; r2Key: string; thumbKey: string | null };

/** Best-effort R2 cleanup: a leftover object costs storage, never correctness. */
async function deleteStoredObjects(rows: StoredFile[]) {
  const keys = rows.flatMap((f) => (f.thumbKey ? [f.r2Key, f.thumbKey] : [f.r2Key]));
  for (let i = 0; i < keys.length; i += 20) {
    await Promise.allSettled(keys.slice(i, i + 20).map(deleteObject));
  }
}

/** Permanently removes files: rows first, then their objects in R2. */
export async function purgeFiles(fileIds: string[]) {
  if (fileIds.length === 0) return 0;
  const removed = await db
    .delete(files)
    .where(inArray(files.id, fileIds))
    .returning({ id: files.id, r2Key: files.r2Key, thumbKey: files.thumbKey });
  await deleteStoredObjects(removed);
  return removed.length;
}

/** Permanently removes a folder, its whole subtree and every file inside. */
export async function purgeFolderTree(path: string) {
  const inSubtree = or(eq(folders.path, path), like(folders.path, `${path}/%`));
  const subtreeIds = db.select({ id: folders.id }).from(folders).where(inSubtree);
  const [removedFiles] = await db.batch([
    db
      .delete(files)
      .where(inArray(files.folderId, subtreeIds))
      .returning({ id: files.id, r2Key: files.r2Key, thumbKey: files.thumbKey }),
    // Grants go with the folders (ON DELETE CASCADE).
    db.delete(folders).where(inSubtree),
  ]);
  await deleteStoredObjects(removedFiles);
  return removedFiles.length;
}

type PurgeFolder = { id: string; path: string; name: string };
type PurgeFile = { id: string; name: string; folder: PurgeFolder };

const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/**
 * Permanently removes trashed folders (with their subtrees) and files, and
 * logs it (`actor` null for the cron). Items inside another folder being
 * purged are skipped: that folder's purge already takes them.
 */
export async function purgeTrashed(
  actor: Session | null,
  items: { folders: PurgeFolder[]; files: PurgeFile[] },
) {
  const roots: PurgeFolder[] = [];
  for (const f of [...items.folders].sort((a, b) => a.path.length - b.path.length)) {
    if (!roots.some((r) => within(f.path, r.path))) roots.push(f);
  }
  const loose = items.files.filter((f) => !roots.some((r) => within(f.folder.path, r.path)));

  let purgedFiles = 0;
  for (const folder of roots) {
    purgedFiles += await purgeFolderTree(folder.path);
    await logActivity(actor, "folder.purge", { folder, meta: { name: folder.name } });
  }
  purgedFiles += await purgeFiles(loose.map((f) => f.id));
  for (const group of Map.groupBy(loose, (f) => f.folder.id).values()) {
    const { folder } = group[0];
    const names = group.map((f) => f.name);
    await logActivity(actor, "file.purge", {
      folder,
      meta: { names: someNames(names), count: names.length, folderName: folder.name },
    });
  }
  return { folders: roots.length, files: purgedFiles };
}
