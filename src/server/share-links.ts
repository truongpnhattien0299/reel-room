import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { files, folders, shareLinkFiles, shareLinks, user, type Folder, type ShareLink } from "@/db/schema";
import { isAdmin, type Session } from "@/lib/auth";
import { isUnlocked } from "@/server/link-password";
import { ancestorIds, getUserRole, requireFolderRole, roleAtLeast } from "@/server/permissions";
import { fileColumns, getFolderStats, grantedOn, hasGrant, toFileItem } from "@/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** 192 random bits, URL-safe. */
export const newShareToken = () => randomBytes(24).toString("base64url");

const inSubtree = (path: string) => or(eq(folders.path, path), like(folders.path, `${path}/%`));

export type ResolvedShareLink =
  | { status: "ok"; link: ShareLink; root: Folder }
  | { status: "locked"; linkId: string }
  | { status: "expired" }
  | { status: "invalid" };

/**
 * Looks up a public link. It works only while it hasn't expired, its folder
 * isn't in the trash, and its creator can still edit that folder — so
 * removing someone from a folder also kills the links they handed out.
 * A link with a password is "locked" until this browser has typed it.
 */
export const resolveShareLink = cache(async (token: string): Promise<ResolvedShareLink> => {
  if (!TOKEN.test(token)) return { status: "invalid" };
  const [row] = await db
    .select({
      link: shareLinks,
      root: folders,
      creator: { id: user.id, role: user.role, banned: user.banned },
    })
    .from(shareLinks)
    .innerJoin(folders, eq(folders.id, shareLinks.folderId))
    .innerJoin(user, eq(user.id, shareLinks.createdBy))
    .where(eq(shareLinks.token, token));
  if (!row || row.root.deletedAt || row.creator.banned) return { status: "invalid" };
  if (row.link.expiresAt && row.link.expiresAt <= new Date()) return { status: "expired" };
  if (!roleAtLeast(await getUserRole(row.creator, row.root), "editor")) return { status: "invalid" };
  if (!(await isUnlocked(row.link))) return { status: "locked", linkId: row.link.id };
  return { status: "ok", link: row.link, root: row.root };
});

/** One more download (a file, or a zip) through the link. */
export async function countDownload(linkId: string) {
  await db
    .update(shareLinks)
    .set({ downloadCount: sql`${shareLinks.downloadCount} + 1` })
    .where(eq(shareLinks.id, linkId));
}

/** A ready, live file the link exposes, or null. */
export async function findSharedFile(link: ShareLink, root: Folder, fileId: string) {
  if (!UUID.test(fileId)) return null;
  const live = and(
    eq(files.id, fileId),
    eq(files.status, "ready"),
    isNull(files.deletedAt),
    isNull(folders.deletedAt),
  );
  const query = db
    .select({ file: files })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId));
  const [row] =
    link.kind === "folder"
      ? await query.where(and(live, inSubtree(root.path)))
      : await query
          .innerJoin(
            shareLinkFiles,
            and(eq(shareLinkFiles.fileId, files.id), eq(shareLinkFiles.linkId, link.id)),
          )
          .where(live);
  return row?.file ?? null;
}

// Visitors aren't signed in: don't tell them who uploaded what.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { uploader, ...publicFileColumns } = fileColumns;
const toPublicFileItem = (f: Omit<Parameters<typeof toFileItem>[0], "uploader">) =>
  toFileItem({ ...f, uploader: null });

/**
 * One folder of a folder link: the shared root or any live folder below it.
 * Null when `folderId` is outside the shared subtree.
 */
export async function getSharedFolderView(root: Folder, folderId?: string) {
  let folder = root;
  if (folderId && folderId !== root.id) {
    if (!UUID.test(folderId)) return null;
    const [sub] = await db
      .select()
      .from(folders)
      .where(
        and(eq(folders.id, folderId), isNull(folders.deletedAt), like(folders.path, `${root.path}/%`)),
      );
    if (!sub) return null;
    folder = sub;
  }

  // Breadcrumbs run from the shared root (never above it) to the parent.
  const ids = ancestorIds(folder);
  const crumbIds = ids.slice(ids.indexOf(root.id), -1);
  const [crumbRows, subfolders, folderFiles] = await Promise.all([
    crumbIds.length
      ? db.select({ id: folders.id, name: folders.name }).from(folders).where(inArray(folders.id, crumbIds))
      : Promise.resolve([]),
    db
      .select({ id: folders.id, name: folders.name })
      .from(folders)
      .where(and(eq(folders.parentId, folder.id), isNull(folders.deletedAt)))
      .orderBy(asc(folders.name)),
    db
      .select(publicFileColumns)
      .from(files)
      .where(and(eq(files.folderId, folder.id), eq(files.status, "ready"), isNull(files.deletedAt)))
      .orderBy(desc(files.createdAt)),
  ]);
  const stats = await getFolderStats(subfolders.map((f) => f.id));
  const byId = new Map(crumbRows.map((c) => [c.id, c]));

  return {
    folder: { id: folder.id, name: folder.name },
    breadcrumbs: crumbIds.map((id) => byId.get(id)!).filter(Boolean),
    subfolders: subfolders.map((f) => ({ ...f, ...stats.get(f.id)! })),
    files: folderFiles.map(toPublicFileItem),
  };
}

/** The files of a "files" link that still exist. */
export async function getSharedFiles(link: ShareLink) {
  const rows = await db
    .select(publicFileColumns)
    .from(shareLinkFiles)
    .innerJoin(files, eq(files.id, shareLinkFiles.fileId))
    .where(
      and(eq(shareLinkFiles.linkId, link.id), eq(files.status, "ready"), isNull(files.deletedAt)),
    )
    .orderBy(desc(files.createdAt));
  return rows.map(toPublicFileItem);
}

/** Options and counters shown next to a link; never the password hash. */
const linkOptionColumns = {
  hasPassword: sql<boolean>`${shareLinks.passwordHash} is not null`,
  allowDownload: shareLinks.allowDownload,
  viewCount: shareLinks.viewCount,
  downloadCount: shareLinks.downloadCount,
  lastViewedAt: shareLinks.lastViewedAt,
};

/** Links created on a folder, for its share dialog. Editors and up. */
export async function listShareLinks(session: Session, folderId: string) {
  await requireFolderRole(session, folderId, "editor");
  return db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      kind: shareLinks.kind,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
      ...linkOptionColumns,
      createdBy: shareLinks.createdBy,
      creatorName: user.name,
      fileCount: sql<number>`(select count(*)::int from ${shareLinkFiles} where ${shareLinkFiles.linkId} = ${shareLinks.id})`,
    })
    .from(shareLinks)
    .innerJoin(user, eq(user.id, shareLinks.createdBy))
    .where(eq(shareLinks.folderId, folderId))
    .orderBy(desc(shareLinks.createdAt));
}

export type ShareLinkItem = Awaited<ReturnType<typeof listShareLinks>>[number];

export type ShareLinkStatus =
  | "active"
  | "expired"
  | "folder_trashed"
  | "creator_banned"
  | "creator_no_access";

/**
 * Every link in the folders the user can edit (admins: all), with whether it
 * still works. The status mirrors `resolveShareLink`'s checks, in its order.
 * `canManage`: the user may change or revoke it (its creator or an owner).
 */
export async function listAllShareLinks(session: Session) {
  const status = sql<ShareLinkStatus>`case
    when ${folders.deletedAt} is not null then 'folder_trashed'
    when coalesce(${user.banned}, false) then 'creator_banned'
    when ${shareLinks.expiresAt} <= now() then 'expired'
    when ${user.role} is distinct from 'admin'
      and not ${hasGrant(shareLinks.createdBy, folders.path, "editor")} then 'creator_no_access'
    else 'active'
  end`;
  const canManage = isAdmin(session)
    ? sql<boolean>`true`
    : sql<boolean>`(${shareLinks.createdBy} = ${session.user.id} or ${hasGrant(session.user.id, folders.path, "owner")})`;

  return db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      kind: shareLinks.kind,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
      ...linkOptionColumns,
      folder: { id: folders.id, name: folders.name },
      creator: { id: user.id, name: user.name, image: user.image },
      fileCount: sql<number>`(select count(*)::int from ${shareLinkFiles} where ${shareLinkFiles.linkId} = ${shareLinks.id})`,
      status,
      canManage,
    })
    .from(shareLinks)
    .innerJoin(folders, eq(folders.id, shareLinks.folderId))
    .innerJoin(user, eq(user.id, shareLinks.createdBy))
    .where(grantedOn(session, folders.path, "editor"))
    .orderBy(desc(shareLinks.createdAt));
}

export type ShareLinkRow = Awaited<ReturnType<typeof listAllShareLinks>>[number];

/** The live files of a "files" link. Editors of its folder only. */
export async function listShareLinkFiles(session: Session, linkId: string) {
  if (!UUID.test(linkId)) return [];
  const [link] = await db
    .select({ id: shareLinks.id })
    .from(shareLinks)
    .innerJoin(folders, eq(folders.id, shareLinks.folderId))
    .where(and(eq(shareLinks.id, linkId), grantedOn(session, folders.path, "editor")));
  if (!link) return [];
  const rows = await db
    .select(fileColumns)
    .from(shareLinkFiles)
    .innerJoin(files, eq(files.id, shareLinkFiles.fileId))
    .innerJoin(user, eq(user.id, files.uploadedBy))
    .where(
      and(eq(shareLinkFiles.linkId, link.id), eq(files.status, "ready"), isNull(files.deletedAt)),
    )
    .orderBy(desc(files.createdAt));
  return rows.map(toFileItem);
}
