import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { favorites, files, folders, user } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { fileColumns, getFolderStats, grantedOn, toFileItem } from "@/server/queries";

/** Ids the user starred, for the star buttons; what they point at isn't checked. */
export async function listFavoriteIds(session: Session) {
  const rows = await db
    .select({ fileId: favorites.fileId, folderId: favorites.folderId })
    .from(favorites)
    .where(eq(favorites.userId, session.user.id));
  return {
    files: rows.flatMap((r) => (r.fileId ? [r.fileId] : [])),
    folders: rows.flatMap((r) => (r.folderId ? [r.folderId] : [])),
  };
}

export type FavoriteIds = Awaited<ReturnType<typeof listFavoriteIds>>;

/**
 * The user's starred folders and files, newest star first. Only what is
 * still live and still readable: a star on something they lost access to
 * stays in the table but isn't listed.
 */
export async function listFavorites(session: Session) {
  const mine = eq(favorites.userId, session.user.id);
  const [folderRows, fileRows] = await Promise.all([
    db
      .select({ id: folders.id, name: folders.name, updatedAt: folders.updatedAt })
      .from(favorites)
      .innerJoin(folders, eq(folders.id, favorites.folderId))
      .where(and(mine, isNotNull(favorites.folderId), isNull(folders.deletedAt), grantedOn(session, folders.path)))
      .orderBy(desc(favorites.createdAt)),
    db
      .select({ ...fileColumns, folderId: folders.id, folderName: folders.name })
      .from(favorites)
      .innerJoin(files, eq(files.id, favorites.fileId))
      .innerJoin(folders, eq(folders.id, files.folderId))
      .innerJoin(user, eq(user.id, files.uploadedBy))
      .where(
        and(
          mine,
          isNotNull(favorites.fileId),
          eq(files.status, "ready"),
          isNull(files.deletedAt),
          isNull(folders.deletedAt),
          grantedOn(session, folders.path),
        ),
      )
      .orderBy(desc(favorites.createdAt)),
  ]);
  const stats = await getFolderStats(folderRows.map((f) => f.id));
  return {
    folders: folderRows.map((f) => ({ ...f, ...stats.get(f.id)! })),
    files: fileRows.map(({ folderId, folderName, ...f }) => ({ ...toFileItem(f), folderId, folderName })),
  };
}

export type Favorites = Awaited<ReturnType<typeof listFavorites>>;
