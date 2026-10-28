"use server";

import { and, asc, eq, gt, inArray, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  files,
  folderPermissions,
  folders,
  invitations,
  session as sessions,
  shareLinkFiles,
  shareLinks,
  user,
  type FolderRole,
} from "@/db/schema";
import { auth, isAdmin, requireSession, type Session } from "@/lib/auth";
import { avatarKey, deleteObject, headObject, presignUploadRequest, thumbKey } from "@/lib/r2";
import {
  ForbiddenError,
  getEffectiveRole,
  NotFoundError,
  requireFolderRole,
  roleAtLeast,
} from "@/server/permissions";
import { INVITE_TTL_DAYS, newInviteToken, resolveInvitation, sendInviteEmail } from "@/server/invitations";
import { purgeFiles, purgeFolderTree } from "@/server/purge";
import { grantedOn, listFolderMembers } from "@/server/queries";
import { listShareLinkFiles, listShareLinks, newShareToken } from "@/server/share-links";

export type ActionResult<T = void> = { error?: string; data?: T };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên không được để trống")
  .max(200, "Tên quá dài")
  .refine((s) => !s.includes("/"), "Tên không được chứa ký tự /");

/**
 * Turns expected failures into `{ error }` so forms can show them. Refreshes
 * the page afterwards unless `refresh: false` (nothing it shows changed).
 */
async function run<T = void>(
  fn: () => Promise<T>,
  opts: { refresh?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (opts.refresh !== false) refresh();
    return data === undefined ? {} : { data };
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return { error: err.message };
    }
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }
    if (isUniqueViolation(err)) {
      return { error: "Đã có folder cùng tên ở đây" };
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolder(parentId: string | null, rawName: string) {
  const session = await requireSession();
  return run(async () => {
    const name = nameSchema.parse(rawName);
    const id = crypto.randomUUID();
    if (parentId === null) {
      // Anyone can start a new top-level folder and becomes its owner.
      await db.batch([
        db.insert(folders).values({ id, name, path: id, createdBy: session.user.id }),
        db.insert(folderPermissions).values({
          folderId: id,
          userId: session.user.id,
          role: "owner",
          grantedBy: session.user.id,
        }),
      ]);
      return;
    }
    const { folder: parent } = await requireFolderRole(session, parentId, "editor");
    await db.insert(folders).values({
      id,
      name,
      parentId: parent.id,
      path: `${parent.path}/${id}`,
      createdBy: session.user.id,
    });
  });
}

export async function renameFolder(folderId: string, rawName: string) {
  const session = await requireSession();
  return run(async () => {
    const name = nameSchema.parse(rawName);
    await requireFolderRole(session, folderId, "editor");
    await db.update(folders).set({ name }).where(eq(folders.id, folderId));
  });
}

/** Soft-deletes the folder, its whole subtree and every file inside. */
export async function trashFolder(folderId: string) {
  const session = await requireSession();
  return run(async () => {
    const { folder } = await requireFolderRole(session, folderId, "editor");
    if (folder.parentId === null) {
      // Removing a top-level folder affects everyone it's shared with.
      await requireFolderRole(session, folderId, "owner");
    }
    const now = new Date();
    const inSubtree = or(eq(folders.path, folder.path), like(folders.path, `${folder.path}/%`));
    await db.batch([
      db
        .update(files)
        .set({ deletedAt: now, deletedBy: session.user.id })
        .where(
          and(
            isNull(files.deletedAt),
            inArray(
              files.folderId,
              db.select({ id: folders.id }).from(folders).where(inSubtree),
            ),
          ),
        ),
      db
        .update(folders)
        .set({ deletedAt: now, deletedBy: session.user.id })
        .where(and(inSubtree, isNull(folders.deletedAt))),
    ]);
  });
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

const shareSchema = z.object({
  email: z.email("Email không hợp lệ").transform((s) => s.toLowerCase()),
  role: z.enum(["viewer", "editor", "owner"]),
});

export async function shareFolder(folderId: string, input: z.input<typeof shareSchema>) {
  const session = await requireSession();
  return run(async () => {
    const { email, role } = shareSchema.parse(input);
    await requireFolderRole(session, folderId, "owner");
    const [target] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!target) throw new NotFoundError("Không có user nào với email này");
    await db
      .insert(folderPermissions)
      .values({ folderId, userId: target.id, role, grantedBy: session.user.id })
      .onConflictDoUpdate({
        target: [folderPermissions.folderId, folderPermissions.userId],
        set: { role, grantedBy: session.user.id },
      });
  });
}

export async function getFolderMembers(folderId: string) {
  const session = await requireSession();
  return listFolderMembers(session, folderId);
}

export async function revokeShare(folderId: string, userId: string) {
  const session = await requireSession();
  return run(async () => {
    await requireFolderRole(session, folderId, "owner");
    if (userId === session.user.id) {
      throw new ForbiddenError("Không thể tự gỡ quyền của chính mình");
    }
    await db
      .delete(folderPermissions)
      .where(and(eq(folderPermissions.folderId, folderId), eq(folderPermissions.userId, userId)));
  });
}

// ---------------------------------------------------------------------------
// Public share links
// ---------------------------------------------------------------------------

/** Custom expiry dates are capped; "never" is a separate, explicit choice. */
const MAX_LINK_DAYS = 365;

const expirySchema = z
  .date()
  .nullable()
  .refine((d) => d === null || d.getTime() > Date.now(), "Thời điểm hết hạn phải ở tương lai")
  .refine(
    (d) => d === null || d.getTime() <= Date.now() + MAX_LINK_DAYS * 86_400_000,
    `Thời hạn tối đa ${MAX_LINK_DAYS} ngày`,
  );

const shareLinkSchema = z.object({
  folderId: z.uuid(),
  /** Share just these files (all in `folderId`); omit to share the whole folder. */
  fileIds: z.array(z.uuid()).min(1, "Chọn ít nhất một file").max(500, "Chọn tối đa 500 file").optional(),
  expiresAt: expirySchema,
});

export async function createShareLink(input: z.input<typeof shareLinkSchema>) {
  const session = await requireSession();
  return run(async () => {
    const { folderId, fileIds, expiresAt } = shareLinkSchema.parse(input);
    await requireFolderRole(session, folderId, "editor");
    const id = crypto.randomUUID();
    const token = newShareToken();
    const link = db.insert(shareLinks).values({
      id,
      token,
      kind: fileIds ? "files" : "folder",
      folderId,
      expiresAt,
      createdBy: session.user.id,
    });
    if (!fileIds) {
      await link;
      return { token };
    }
    const unique = [...new Set(fileIds)];
    const found = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          inArray(files.id, unique),
          eq(files.folderId, folderId),
          eq(files.status, "ready"),
          isNull(files.deletedAt),
        ),
      );
    if (found.length !== unique.length) throw new NotFoundError("Một số file không còn trong folder này");
    await db.batch([
      link,
      db.insert(shareLinkFiles).values(unique.map((fileId) => ({ linkId: id, fileId }))),
    ]);
    return { token };
  });
}

export async function getShareLinks(folderId: string) {
  const session = await requireSession();
  return listShareLinks(session, folderId);
}

/**
 * Asserts the user may change or revoke every one of these links: its creator
 * (still an editor of the folder) or an owner. Works on trashed folders too,
 * so their links can still be cleaned up.
 */
async function requireLinkManager(session: Session, linkIds: string[]) {
  const links = await db
    .select({
      id: shareLinks.id,
      createdBy: shareLinks.createdBy,
      folderId: folders.id,
      path: folders.path,
      deletedAt: folders.deletedAt,
    })
    .from(shareLinks)
    .innerJoin(folders, eq(folders.id, shareLinks.folderId))
    .where(inArray(shareLinks.id, linkIds));
  if (links.length !== new Set(linkIds).size) throw new NotFoundError("Link không tồn tại");
  const roles = new Map<string, Promise<FolderRole | null>>();
  for (const link of links) {
    if (!roles.has(link.folderId)) roles.set(link.folderId, getEffectiveRole(session, link));
    const role = await roles.get(link.folderId)!;
    if (role === null) throw new NotFoundError("Link không tồn tại");
    if (!roleAtLeast(role, "editor") || (link.createdBy !== session.user.id && role !== "owner")) {
      throw new ForbiddenError("Chỉ người tạo link hoặc chủ sở hữu folder mới thay đổi được link");
    }
  }
  return links;
}

const linkIdsSchema = z.array(z.uuid()).min(1, "Chọn ít nhất một link").max(500, "Chọn tối đa 500 link");

/** The link's creator or a folder owner may revoke it. */
export async function deleteShareLink(linkId: string) {
  return deleteShareLinks([linkId]);
}

export async function deleteShareLinks(linkIds: string[]) {
  const session = await requireSession();
  return run(async () => {
    const ids = linkIdsSchema.parse(linkIds);
    await requireLinkManager(session, ids);
    await db.delete(shareLinks).where(inArray(shareLinks.id, ids));
  });
}

export async function updateShareLinkExpiry(linkId: string, expiresAt: Date | null) {
  const session = await requireSession();
  return run(async () => {
    const [link] = await requireLinkManager(session, [z.uuid().parse(linkId)]);
    if (link.deletedAt) throw new ForbiddenError("Folder đang trong thùng rác, hãy khôi phục trước");
    await db
      .update(shareLinks)
      .set({ expiresAt: expirySchema.parse(expiresAt) })
      .where(eq(shareLinks.id, link.id));
  });
}

export async function getShareLinkFiles(linkId: string) {
  const session = await requireSession();
  return listShareLinkFiles(session, linkId);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function requireFileRole(fileId: string, min: "viewer" | "editor") {
  const session = await requireSession();
  const [file] = await db
    .select({ id: files.id, folderId: files.folderId })
    .from(files)
    .where(and(eq(files.id, fileId), isNull(files.deletedAt)));
  if (!file) throw new NotFoundError("File không tồn tại");
  await requireFolderRole(session, file.folderId, min);
  return file;
}

export async function renameFile(fileId: string, rawName: string) {
  return run(async () => {
    const name = nameSchema.parse(rawName);
    await requireFileRole(fileId, "editor");
    await db.update(files).set({ name }).where(eq(files.id, fileId));
  });
}

/** A ready file the caller can edit that still has no thumbnail. */
async function requireThumblessFile(fileId: string) {
  z.uuid().parse(fileId);
  const session = await requireSession();
  const [file] = await db
    .select({ folderId: files.folderId })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.status, "ready"),
        isNull(files.deletedAt),
        isNull(files.thumbKey),
      ),
    );
  if (!file) throw new NotFoundError("File không tồn tại hoặc đã có thumbnail");
  await requireFolderRole(session, file.folderId, "editor");
}

/**
 * Signed PUT for a thumbnail made in the viewer, for files whose upload-time
 * thumbnail never reached storage.
 */
export async function signThumbnailUpload(fileId: string) {
  return run(
    async () => {
      await requireThumblessFile(fileId);
      const contentType = "image/webp";
      const url = await presignUploadRequest({ op: "putObject", key: thumbKey(fileId), contentType });
      return { url, headers: { "Content-Type": contentType } };
    },
    { refresh: false },
  );
}

/** Links a thumbnail uploaded through `signThumbnailUpload` to its file. */
export async function attachThumbnail(fileId: string) {
  return run(async () => {
    await requireThumblessFile(fileId);
    if (!(await headObject(thumbKey(fileId)))) throw new NotFoundError("Thumbnail chưa có trên storage");
    await db
      .update(files)
      .set({ thumbKey: thumbKey(fileId) })
      .where(and(eq(files.id, fileId), isNull(files.thumbKey)));
  });
}

const fileIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .transform((ids) => [...new Set(ids)]);

/** Trashes live files, possibly from several folders: editor on each one. */
export async function trashFiles(fileIds: string[]) {
  const session = await requireSession();
  return run(async () => {
    const ids = fileIdsSchema.parse(fileIds);
    const rows = await db
      .select({ folderId: files.folderId })
      .from(files)
      .where(and(inArray(files.id, ids), isNull(files.deletedAt)));
    if (rows.length !== ids.length) throw new NotFoundError("File không tồn tại");
    for (const folderId of new Set(rows.map((r) => r.folderId))) {
      await requireFolderRole(session, folderId, "editor");
    }
    await db
      .update(files)
      .set({ deletedAt: new Date(), deletedBy: session.user.id })
      .where(and(inArray(files.id, ids), isNull(files.deletedAt)));
  });
}

export async function trashFile(fileId: string) {
  return trashFiles([fileId]);
}

// ---------------------------------------------------------------------------
// Moving files and folders
// ---------------------------------------------------------------------------

const MOVE_TARGET_LIMIT = 2000;

/**
 * Folders the user may move things into (editor and up), for the move dialog,
 * plus how many of `fileIds` sit in a share link of their current folder and
 * would be dropped from it by a move.
 */
export async function getMoveTargets(fileIds: string[] = []) {
  const session = await requireSession();
  return run(
    async () => {
      const ids = z.array(z.uuid()).max(500).parse(fileIds);
      const [rows, [linked]] = await Promise.all([
        db
          .select({ id: folders.id, name: folders.name, parentId: folders.parentId, path: folders.path })
          .from(folders)
          .where(and(isNull(folders.deletedAt), grantedOn(session, folders.path, "editor")))
          .orderBy(asc(folders.name))
          .limit(MOVE_TARGET_LIMIT + 1),
        ids.length
          ? db
              .select({ count: sql<number>`count(distinct ${shareLinkFiles.fileId})::int` })
              .from(shareLinkFiles)
              .innerJoin(files, eq(files.id, shareLinkFiles.fileId))
              .innerJoin(shareLinks, eq(shareLinks.id, shareLinkFiles.linkId))
              .where(and(inArray(shareLinkFiles.fileId, ids), eq(shareLinks.folderId, files.folderId)))
          : Promise.resolve([{ count: 0 }]),
      ]);
      return {
        folders: rows.slice(0, MOVE_TARGET_LIMIT),
        truncated: rows.length > MOVE_TARGET_LIMIT,
        linkedFiles: linked?.count ?? 0,
      };
    },
    { refresh: false },
  );
}

/**
 * Moves files of one folder into another. Needs editor on both. A "files"
 * link may only expose files of its own folder, so the moved files leave the
 * links of the folder they came from.
 */
export async function moveFiles(fileIds: string[], destFolderId: string) {
  const session = await requireSession();
  return run(async () => {
    const ids = z.array(z.uuid()).min(1).max(500).parse(fileIds);
    z.uuid().parse(destFolderId);
    const rows = await db
      .select({ folderId: files.folderId })
      .from(files)
      .where(and(inArray(files.id, ids), isNull(files.deletedAt)));
    if (rows.length !== new Set(ids).size) throw new NotFoundError("File không tồn tại");
    const sourceId = rows[0].folderId;
    if (rows.some((r) => r.folderId !== sourceId)) {
      throw new ForbiddenError("Chỉ di chuyển được các file trong cùng một folder");
    }
    await requireFolderRole(session, sourceId, "editor");
    await requireFolderRole(session, destFolderId, "editor");
    if (sourceId === destFolderId) return;
    await db.batch([
      db
        .update(files)
        .set({ folderId: destFolderId })
        .where(and(inArray(files.id, ids), eq(files.folderId, sourceId), isNull(files.deletedAt))),
      db
        .delete(shareLinkFiles)
        .where(
          and(
            inArray(shareLinkFiles.fileId, ids),
            inArray(
              shareLinkFiles.linkId,
              db.select({ id: shareLinks.id }).from(shareLinks).where(eq(shareLinks.folderId, sourceId)),
            ),
          ),
        ),
    ]);
  });
}

/**
 * Moves a subfolder under another folder, rewriting the `path` of its whole
 * subtree (trashed folders included, so paths stay consistent). Top-level
 * folders stay where they are: their own grants make up a shared space.
 */
export async function moveFolder(folderId: string, destParentId: string) {
  const session = await requireSession();
  return run(async () => {
    z.uuid().parse(folderId);
    z.uuid().parse(destParentId);
    const { folder } = await requireFolderRole(session, folderId, "editor");
    if (folder.parentId === null) throw new ForbiddenError("Không di chuyển được folder gốc");
    const { folder: dest } = await requireFolderRole(session, destParentId, "editor");
    if (dest.path === folder.path || dest.path.startsWith(`${folder.path}/`)) {
      throw new ForbiddenError("Không thể chuyển folder vào chính nó hoặc folder con của nó");
    }
    if (folder.parentId === dest.id) return;
    const newPath = `${dest.path}/${folder.id}`;
    await db.batch([
      db
        .update(folders)
        .set({
          path: sql`${newPath} || substr(${folders.path}, ${folder.path.length + 1})`,
          parentId: sql`case when ${folders.id} = ${folder.id} then ${dest.id}::uuid else ${folders.parentId} end`,
        })
        .where(or(eq(folders.path, folder.path), like(folders.path, `${folder.path}/%`))),
    ]);
  });
}

// ---------------------------------------------------------------------------
// Trash: restore and permanent delete
// ---------------------------------------------------------------------------

/**
 * Loads a trashed folder the user may manage: editor on it, owner when it was
 * a top-level folder (the same rule as trashing it).
 */
async function requireTrashedFolder(folderId: string) {
  const session = await requireSession();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), isNotNull(folders.deletedAt)));
  if (!folder) throw new NotFoundError("Không còn trong thùng rác");
  const role = await getEffectiveRole(session, folder);
  if (!roleAtLeast(role, folder.parentId === null ? "owner" : "editor")) {
    throw new ForbiddenError();
  }
  return folder;
}

async function requireTrashedFile(fileId: string) {
  const session = await requireSession();
  const [row] = await db
    .select({ file: files, folder: folders })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, fileId), isNotNull(files.deletedAt)));
  if (!row) throw new NotFoundError("Không còn trong thùng rác");
  if (!roleAtLeast(await getEffectiveRole(session, row.folder), "editor")) {
    throw new ForbiddenError();
  }
  return row;
}

/** Restores the folder and whatever was trashed together with it. */
export async function restoreFolder(folderId: string) {
  return run(async () => {
    const folder = await requireTrashedFolder(folderId);
    if (folder.parentId) {
      const [parent] = await db
        .select({ deletedAt: folders.deletedAt })
        .from(folders)
        .where(eq(folders.id, folder.parentId));
      if (parent?.deletedAt) {
        throw new ForbiddenError("Folder cha cũng đang trong thùng rác. Khôi phục folder cha trước.");
      }
    }
    // Items trashed earlier on their own keep their own timestamp and stay put.
    const stamp = folder.deletedAt!;
    const inSubtree = or(eq(folders.path, folder.path), like(folders.path, `${folder.path}/%`));
    await db.batch([
      db
        .update(folders)
        .set({ deletedAt: null, deletedBy: null })
        .where(and(inSubtree, eq(folders.deletedAt, stamp))),
      db
        .update(files)
        .set({ deletedAt: null, deletedBy: null })
        .where(
          and(
            eq(files.deletedAt, stamp),
            inArray(files.folderId, db.select({ id: folders.id }).from(folders).where(inSubtree)),
          ),
        ),
    ]);
  });
}

/** Restores trashed files (the "undo" of `trashFiles`): editor on each folder. */
export async function restoreFiles(fileIds: string[]) {
  const session = await requireSession();
  return run(async () => {
    const ids = fileIdsSchema.parse(fileIds);
    const rows = await db
      .select({ folder: folders })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .where(and(inArray(files.id, ids), isNotNull(files.deletedAt)));
    if (rows.length !== ids.length) throw new NotFoundError("Không còn trong thùng rác");
    const byId = new Map(rows.map((r) => [r.folder.id, r.folder]));
    for (const folder of byId.values()) {
      if (!roleAtLeast(await getEffectiveRole(session, folder), "editor")) throw new ForbiddenError();
      if (folder.deletedAt) {
        throw new ForbiddenError(`Folder “${folder.name}” đang trong thùng rác. Khôi phục folder trước.`);
      }
    }
    await db
      .update(files)
      .set({ deletedAt: null, deletedBy: null })
      .where(and(inArray(files.id, ids), isNotNull(files.deletedAt)));
  });
}

export async function restoreFile(fileId: string) {
  return restoreFiles([fileId]);
}

export async function purgeFolder(folderId: string) {
  return run(async () => {
    const folder = await requireTrashedFolder(folderId);
    await purgeFolderTree(folder.path);
  });
}

export async function purgeFile(fileId: string) {
  return run(async () => {
    await requireTrashedFile(fileId);
    await purgeFiles([fileId]);
  });
}

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.email("Email không hợp lệ").transform((s) => s.toLowerCase()),
  role: z.enum(["user", "admin"]),
});

/**
 * Creates (or renews) the invite link for an email and mails it. The link is
 * also returned so the admin can pass it on directly; the account itself is
 * created only when the invitee opens it and picks a name and password.
 */
export async function inviteUser(input: z.input<typeof inviteSchema>) {
  const session = await requireSession();
  return run(async () => {
    if (!isAdmin(session)) throw new ForbiddenError();
    const { email, role } = inviteSchema.parse(input);
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) throw new ForbiddenError("Email này đã có tài khoản");
    const token = newInviteToken();
    const fields = {
      token,
      role,
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      createdAt: new Date(),
    };
    await db
      .insert(invitations)
      .values({ email, ...fields })
      .onConflictDoUpdate({ target: invitations.email, set: fields });
    const emailed = await sendInviteEmail(email, token, session.user.name);
    return { token, emailed };
  });
}

export async function revokeInvite(invitationId: string) {
  const session = await requireSession();
  return run(async () => {
    if (!isAdmin(session)) throw new ForbiddenError();
    await db.delete(invitations).where(eq(invitations.id, z.uuid().parse(invitationId)));
  });
}

const acceptSchema = z.object({
  token: z.string(),
  name: z.string().trim().min(1, "Nhập tên").max(100, "Tên quá dài"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài"),
});

/** Public: the invitee creates their account from the link, then is signed in. */
export async function acceptInvite(input: z.input<typeof acceptSchema>) {
  const res = await run(async () => {
    const { token, name, password } = acceptSchema.parse(input);
    const resolved = await resolveInvitation(token);
    if (resolved.status === "registered") {
      throw new ForbiddenError("Email này đã có tài khoản, hãy đăng nhập");
    }
    // Consume the invite first, so the same link can't create two accounts.
    const [invite] = await db
      .delete(invitations)
      .where(and(eq(invitations.token, token), gt(invitations.expiresAt, new Date())))
      .returning();
    if (!invite) throw new ForbiddenError("Link mời đã hết hạn hoặc đã được dùng");
    try {
      await auth.api.createUser({
        body: { email: invite.email, name, password, role: invite.role as "user" | "admin" },
      });
    } catch (err) {
      await db.insert(invitations).values(invite).onConflictDoNothing();
      throw err;
    }
    await auth.api.signInEmail({
      body: { email: invite.email, password },
      headers: await headers(),
    });
  });
  if (!res.error) redirect("/");
  return res;
}

// ---------------------------------------------------------------------------
// Managing an account (admin)
// ---------------------------------------------------------------------------

const userIdSchema = z.string().min(1).max(100);

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên").max(100, "Tên quá dài"),
  email: z.email("Email không hợp lệ").transform((s) => s.toLowerCase()),
});

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(128, "Mật khẩu quá dài");

/** Admin-only: loads the account an admin is about to change. */
async function requireManagedUser(userId: string) {
  const session = await requireSession();
  if (!isAdmin(session)) throw new ForbiddenError();
  const [target] = await db
    .select({ id: user.id, email: user.email, role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, userIdSchema.parse(userId)));
  if (!target) throw new NotFoundError("User không tồn tại");
  return { session, target, self: target.id === session.user.id };
}

/** Someone has to be left who can manage users. */
async function assertNotLastAdmin(target: { id: string; role: string | null; banned: boolean | null }) {
  if (target.role !== "admin" || target.banned) return;
  const [other] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), ne(user.id, target.id), sql`${user.banned} is not true`))
    .limit(1);
  if (!other) throw new ForbiddenError("Phải còn ít nhất một admin đang hoạt động");
}

export async function updateUserProfile(userId: string, input: z.input<typeof profileSchema>) {
  return run(async () => {
    const { target } = await requireManagedUser(userId);
    const { name, email } = profileSchema.parse(input);
    if (email !== target.email) {
      const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
      if (taken) throw new ForbiddenError("Email này đã có tài khoản");
    }
    await db.batch([
      db.update(user).set({ name, email }).where(eq(user.id, target.id)),
      // A pending invite for the new address would otherwise create a second account.
      db.delete(invitations).where(eq(invitations.email, email)),
    ]);
  });
}

export async function setUserRole(userId: string, rawRole: "user" | "admin") {
  return run(async () => {
    const { target, self } = await requireManagedUser(userId);
    const role = z.enum(["user", "admin"]).parse(rawRole);
    if (role === target.role) return;
    if (self) throw new ForbiddenError("Không thể tự đổi vai trò của chính mình");
    if (role === "user") await assertNotLastAdmin(target);
    await db.update(user).set({ role }).where(eq(user.id, target.id));
  });
}

/**
 * Locks an account instead of deleting it (files and folders keep pointing at
 * it): sign-in is refused, current sessions end, and public links it created
 * stop working until it is unlocked (see `resolveShareLink`).
 */
export async function lockUser(userId: string, rawReason?: string) {
  return run(async () => {
    const { target, self } = await requireManagedUser(userId);
    if (self) throw new ForbiddenError("Không thể tự khoá tài khoản của chính mình");
    await assertNotLastAdmin(target);
    const reason = z.string().trim().max(200, "Lý do quá dài").optional().parse(rawReason);
    await db.batch([
      db
        .update(user)
        .set({ banned: true, banReason: reason || null, banExpires: null })
        .where(eq(user.id, target.id)),
      db.delete(sessions).where(eq(sessions.userId, target.id)),
    ]);
  });
}

export async function unlockUser(userId: string) {
  return run(async () => {
    const { target } = await requireManagedUser(userId);
    await db
      .update(user)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(user.id, target.id));
  });
}

/**
 * Mails a set-password link: a reset for active accounts, the activation link
 * for accounts invited before invite links existed.
 */
export async function sendPasswordReset(userId: string) {
  return run(
    async () => {
      const { target } = await requireManagedUser(userId);
      await auth.api.requestPasswordReset({
        body: {
          email: target.email,
          redirectTo: `${process.env.BETTER_AUTH_URL}/reset-password`,
        },
      });
    },
    { refresh: false },
  );
}

/** For when mail isn't set up: the admin picks a password and passes it on. */
export async function setUserPassword(userId: string, rawPassword: string) {
  return run(async () => {
    const { target, self } = await requireManagedUser(userId);
    if (self) throw new ForbiddenError("Đổi mật khẩu của chính mình bằng link đặt lại mật khẩu");
    const newPassword = passwordSchema.parse(rawPassword);
    await auth.api.setUserPassword({
      body: { userId: target.id, newPassword },
      headers: await headers(),
    });
    await db.delete(sessions).where(eq(sessions.userId, target.id));
  });
}

/** Signs the user out everywhere. */
export async function revokeUserSessions(userId: string) {
  return run(async () => {
    const { target, self } = await requireManagedUser(userId);
    if (self) throw new ForbiddenError("Không thể tự đăng xuất mọi phiên của chính mình ở đây");
    await db.delete(sessions).where(eq(sessions.userId, target.id));
  });
}

// ---------------------------------------------------------------------------
// Own profile
// ---------------------------------------------------------------------------

/** Avatars are 256px WebP made in the browser; anything bigger isn't one. */
const MAX_AVATAR_BYTES = 512 * 1024;

export async function updateMyName(rawName: string) {
  const session = await requireSession();
  return run(async () => {
    const name = z.string().trim().min(1, "Nhập tên").max(100, "Tên quá dài").parse(rawName);
    await db.update(user).set({ name }).where(eq(user.id, session.user.id));
  });
}

/** Signed PUT for a new avatar under the caller's own prefix. */
export async function signAvatarUpload() {
  const session = await requireSession();
  return run(
    async () => {
      const key = avatarKey(session.user.id);
      const contentType = "image/webp";
      const url = await presignUploadRequest({ op: "putObject", key, contentType });
      return { key, url, headers: { "Content-Type": contentType } };
    },
    { refresh: false },
  );
}

/** Points the profile at an avatar uploaded through `signAvatarUpload`. */
export async function setMyAvatar(key: string) {
  const session = await requireSession();
  return run(async () => {
    const prefix = `avatars/${session.user.id}/`;
    if (!key.startsWith(prefix) || !/^[0-9a-f-]{36}\.webp$/.test(key.slice(prefix.length))) {
      throw new ForbiddenError();
    }
    const head = await headObject(key);
    if (!head) throw new NotFoundError("Ảnh chưa có trên storage");
    if (head.size > MAX_AVATAR_BYTES) {
      await deleteObject(key);
      throw new ForbiddenError("Ảnh quá lớn");
    }
    const [prev] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, session.user.id));
    await db.update(user).set({ image: key }).where(eq(user.id, session.user.id));
    await deleteAvatarObject(prev?.image);
  });
}

export async function removeMyAvatar() {
  const session = await requireSession();
  return run(async () => {
    const [prev] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, session.user.id));
    await db.update(user).set({ image: null }).where(eq(user.id, session.user.id));
    await deleteAvatarObject(prev?.image);
  });
}

/** Best effort: a leftover object only costs a few KB. */
async function deleteAvatarObject(key: string | null | undefined) {
  if (!key?.startsWith("avatars/")) return;
  try {
    await deleteObject(key);
  } catch (err) {
    console.error(err);
  }
}
