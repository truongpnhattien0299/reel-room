import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
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
      .select(fileColumns)
      .from(files)
      .innerJoin(user, eq(user.id, files.uploadedBy))
      .where(
        and(eq(files.folderId, folder.id), eq(files.status, "ready"), isNull(files.deletedAt)),
      )
      .orderBy(desc(files.createdAt)),
  ]);
  const stats = await getFolderStats(subfolders.map((f) => f.id));

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
    subfolders: subfolders.map((f) => ({ ...f, ...stats.get(f.id)! })),
    files: folderFiles.map(toFileItem),
  };
}

export type FolderView = Awaited<ReturnType<typeof getFolderView>>;

export const fileColumns = {
  id: files.id,
  name: files.name,
  mimeType: files.mimeType,
  size: files.size,
  thumbKey: files.thumbKey,
  width: files.width,
  height: files.height,
  durationMs: files.durationMs,
  createdAt: files.createdAt,
  uploaderName: user.name,
};

export function toFileItem({ thumbKey, ...f }: { thumbKey: string | null } & Omit<FileItem, "hasThumb">) {
  return { ...f, hasThumb: thumbKey !== null };
}

export type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  hasThumb: boolean;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: Date;
  uploaderName: string;
};

export type FolderStats = {
  itemCount: number;
  totalSize: number;
  lastUpload: Date | null;
  /** Up to three of the newest files with a thumbnail, anywhere in the subtree. */
  previewIds: string[];
};

/** Item count, size and cover thumbnails for each folder's whole subtree. */
export async function getFolderStats(folderIds: string[]): Promise<Map<string, FolderStats>> {
  const result = new Map<string, FolderStats>();
  if (folderIds.length === 0) return result;
  const { rows } = await db.execute<{
    id: string;
    item_count: number;
    total_size: string;
    last_upload: string | null;
    preview_ids: string[] | null;
  }>(sql`
    select f.id,
           count(x.id)::int as item_count,
           coalesce(sum(x.size), 0)::text as total_size,
           max(x.created_at) as last_upload,
           (array_agg(x.id order by x.created_at desc) filter (where x.thumb_key is not null))[1:3] as preview_ids
    from folders f
    left join folders y
      on (y.path = f.path or y.path like f.path || '/%') and y.deleted_at is null
    left join files x
      on x.folder_id = y.id and x.status = 'ready' and x.deleted_at is null
    where f.id in (${sql.join(folderIds.map((id) => sql`${id}`), sql`, `)})
    group by f.id
  `);
  for (const r of rows) {
    result.set(r.id, {
      itemCount: r.item_count,
      totalSize: Number(r.total_size),
      lastUpload: r.last_upload ? new Date(r.last_upload) : null,
      previewIds: r.preview_ids ?? [],
    });
  }
  return result;
}

/** Root folders with their cover stats, for the library page. */
export async function listRootFoldersWithStats(session: Session) {
  const roots = await listRootFolders(session);
  const stats = await getFolderStats(roots.map((f) => f.id));
  return roots
    .map((f) => ({ ...f, ...stats.get(f.id)! }))
    .sort((a, b) => (b.lastUpload?.getTime() ?? 0) - (a.lastUpload?.getTime() ?? 0));
}

export type LibraryFolder = Awaited<ReturnType<typeof listRootFoldersWithStats>>[number];

/**
 * SQL condition: the user holds a grant (of at least `min`) on the folder at
 * `path` or one of its ancestors. Undefined for admins, who see everything.
 */
function grantedOn(session: Session, path: SQL | AnyColumn, min: "viewer" | "editor" = "viewer") {
  if (isAdmin(session)) return undefined;
  const roles = min === "viewer" ? sql`('viewer','editor','owner')` : sql`('editor','owner')`;
  return sql`exists (
    select 1 from folder_permissions p
    join folders g on g.id = p.folder_id
    where p.user_id = ${session.user.id}
      and p.role in ${roles}
      and (${path} = g.path or ${path} like g.path || '/%')
  )`;
}

/** Newest files across every folder the user can see. */
export async function listRecentFiles(session: Session, limit = 12) {
  const visible = grantedOn(session, folders.path);
  const rows = await db
    .select({ ...fileColumns, folderId: folders.id, folderName: folders.name })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .innerJoin(user, eq(user.id, files.uploadedBy))
    .where(
      and(
        eq(files.status, "ready"),
        isNull(files.deletedAt),
        isNull(folders.deletedAt),
        visible,
      ),
    )
    .orderBy(desc(files.createdAt))
    .limit(limit);
  return rows.map(({ folderId, folderName, ...f }) => ({
    ...toFileItem(f),
    folderId,
    folderName,
  }));
}

export type RecentFile = Awaited<ReturnType<typeof listRecentFiles>>[number];

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

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Accent- and case-insensitive substring match: "san khau" finds "Sân khấu". */
const nameMatches = (column: AnyColumn, term: string) =>
  sql`unaccent(${column}) ilike unaccent(${`%${escapeLike(term)}%`})`;

const parentFolder = alias(folders, "parent_folder");

export async function searchLibrary(session: Session, rawTerm: string) {
  const term = rawTerm.trim().slice(0, 100);
  if (!term) return { folders: [], files: [] };

  const [folderRows, fileRows] = await Promise.all([
    db
      .select({ id: folders.id, name: folders.name, parentName: parentFolder.name })
      .from(folders)
      .leftJoin(parentFolder, eq(parentFolder.id, folders.parentId))
      .where(
        and(isNull(folders.deletedAt), nameMatches(folders.name, term), grantedOn(session, folders.path)),
      )
      .orderBy(asc(folders.name))
      .limit(20),
    db
      .select({ ...fileColumns, folderId: folders.id, folderName: folders.name })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .innerJoin(user, eq(user.id, files.uploadedBy))
      .where(
        and(
          eq(files.status, "ready"),
          isNull(files.deletedAt),
          isNull(folders.deletedAt),
          nameMatches(files.name, term),
          grantedOn(session, folders.path),
        ),
      )
      .orderBy(desc(files.createdAt))
      .limit(60),
  ]);

  return {
    folders: folderRows,
    files: fileRows.map(({ folderId, folderName, ...f }) => ({ ...toFileItem(f), folderId, folderName })),
  };
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

/** Trashed items stay this long before the daily cron purges them. */
export const TRASH_RETENTION_DAYS = 30;

const deleter = alias(user, "deleter");

export type TrashItem = {
  kind: "folder" | "file";
  id: string;
  name: string;
  /** Where it lived: the parent folder (folders) or containing folder (files). */
  location: string | null;
  deletedAt: Date;
  deletedByName: string | null;
  /** Whole days until the cron purges it (0 = today). */
  daysLeft: number;
  mimeType?: string;
  hasThumb?: boolean;
  size?: number;
};

/**
 * Items the user deleted directly — a folder trashed together with its parent
 * (same timestamp) is represented by that parent, not listed again. Only items
 * the user can edit are shown, since only they can restore them.
 */
export async function listTrash(session: Session): Promise<TrashItem[]> {
  const [folderRows, fileRows] = await Promise.all([
    db
      .select({
        id: folders.id,
        name: folders.name,
        location: parentFolder.name,
        deletedAt: folders.deletedAt,
        deletedByName: deleter.name,
      })
      .from(folders)
      .leftJoin(parentFolder, eq(parentFolder.id, folders.parentId))
      .leftJoin(deleter, eq(deleter.id, folders.deletedBy))
      .where(
        and(
          isNotNull(folders.deletedAt),
          or(isNull(parentFolder.id), isNull(parentFolder.deletedAt), ne(parentFolder.deletedAt, folders.deletedAt)),
          grantedOn(session, folders.path, "editor"),
        ),
      ),
    db
      .select({
        id: files.id,
        name: files.name,
        location: folders.name,
        deletedAt: files.deletedAt,
        deletedByName: deleter.name,
        mimeType: files.mimeType,
        thumbKey: files.thumbKey,
        size: files.size,
      })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .leftJoin(deleter, eq(deleter.id, files.deletedBy))
      .where(
        and(
          isNotNull(files.deletedAt),
          eq(files.status, "ready"),
          or(isNull(folders.deletedAt), ne(folders.deletedAt, files.deletedAt)),
          grantedOn(session, folders.path, "editor"),
        ),
      ),
  ]);

  const now = Date.now();
  const daysLeft = (d: Date) =>
    Math.max(0, Math.ceil((d.getTime() + TRASH_RETENTION_DAYS * 86_400_000 - now) / 86_400_000));
  return [
    ...folderRows.map((f) => ({
      ...f,
      kind: "folder" as const,
      deletedAt: f.deletedAt!,
      daysLeft: daysLeft(f.deletedAt!),
    })),
    ...fileRows.map(({ thumbKey, ...f }) => ({
      ...f,
      kind: "file" as const,
      deletedAt: f.deletedAt!,
      daysLeft: daysLeft(f.deletedAt!),
      hasThumb: thumbKey !== null,
    })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
