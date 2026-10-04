import "server-only";
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import { deleteObject } from "@/lib/r2";

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
