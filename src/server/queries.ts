import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { account, files, folderPermissions, folders, user, type FolderRole } from "@/db/schema";
import { isAdmin, type Session } from "@/lib/auth";
import { ancestorIds, requireFolderRole } from "@/server/permissions";

export type FolderSummary = { id: string; name: string };
export type FolderWithRole = FolderSummary & { role: FolderRole };

/**
 * Top-level folders the user can reach: real roots for admins, otherwise the
 * highest folders they hold a grant on (a grant on a parent already covers its
 * children, so those aren't listed twice).
 */
export async function listRootFolders(session: Session): Promise<FolderWithRole[]> {
  if (isAdmin(session)) {
    const roots = await db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(isNull(folders.parentId), isNull(folders.deletedAt)))
      .orderBy(asc(folders.name));
    return roots.map((f) => ({ ...f, role: "owner" as const }));
  }
  const granted = await db
    .select({ id: folders.id, name: folders.name, path: folders.path, role: folderPermissions.role })
    .from(folderPermissions)
    .innerJoin(folders, eq(folders.id, folderPermissions.folderId))
    .where(and(eq(folderPermissions.userId, session.user.id), isNull(folders.deletedAt)))
    .orderBy(asc(folders.name));
  const grantedIds = new Set(granted.map((f) => f.id));
  return granted
    .filter((f) => !ancestorIds(f).slice(0, -1).some((id) => grantedIds.has(id)))
    .map(({ id, name, role }) => ({ id, name, role }));
}

export async function getFolderView(session: Session, folderId: string) {
  const { folder, role } = await requireFolderRole(session, folderId, "viewer");

  const ancestors = ancestorIds(folder).slice(0, -1);
  const [ancestorRows, accessibleIds, subfolders, folderFiles] = await Promise.all([
    ancestors.length
      ? db
          .select({ id: folders.id, name: folders.name })
          .from(folders)
          .where(inArray(folders.id, ancestors))
      : Promise.resolve([]),
    isAdmin(session)
      ? Promise.resolve(null)
      : db
          .select({ id: folderPermissions.folderId })
          .from(folderPermissions)
          .where(
            and(
              eq(folderPermissions.userId, session.user.id),
              inArray(folderPermissions.folderId, ancestorIds(folder)),
            ),
          )
          .then((rows) => new Set(rows.map((r) => r.id))),
    db
      .select({ id: folders.id, name: folders.name, updatedAt: folders.updatedAt })
      .from(folders)
      .where(and(eq(folders.parentId, folder.id), isNull(folders.deletedAt)))
      .orderBy(asc(folders.name)),
    db
      .select({
        id: files.id,
        name: files.name,
        mimeType: files.mimeType,
        size: files.size,
        hasThumb: files.thumbKey,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(
        and(eq(files.folderId, folder.id), eq(files.status, "ready"), isNull(files.deletedAt)),
      )
      .orderBy(desc(files.createdAt)),
  ]);

  // Breadcrumbs start at the highest ancestor the user can see.
  const byId = new Map(ancestorRows.map((a) => [a.id, a]));
  const firstVisible = accessibleIds
    ? ancestorIds(folder).findIndex((id) => accessibleIds.has(id))
    : 0;
  const breadcrumbs = ancestors
    .slice(firstVisible)
    .map((id) => byId.get(id))
    .filter((a): a is FolderSummary => a !== undefined);

  return {
    folder: { id: folder.id, name: folder.name, parentId: folder.parentId },
    role,
    breadcrumbs,
    subfolders,
    files: folderFiles.map(({ hasThumb, ...f }) => ({ ...f, hasThumb: hasThumb !== null })),
  };
}

export type FolderView = Awaited<ReturnType<typeof getFolderView>>;
export type FileItem = FolderView["files"][number];

/** Direct grants on a folder (inherited ones are managed on the ancestor). */
export async function listFolderMembers(session: Session, folderId: string) {
  await requireFolderRole(session, folderId, "viewer");
  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: folderPermissions.role,
    })
    .from(folderPermissions)
    .innerJoin(user, eq(user.id, folderPermissions.userId))
    .where(eq(folderPermissions.folderId, folderId))
    .orderBy(asc(user.name));
}

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      // Invited users get a credential account only once they set a password.
      activated: sql<boolean>`${account.id} is not null`,
    })
    .from(user)
    .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
    .orderBy(asc(user.name));
}
