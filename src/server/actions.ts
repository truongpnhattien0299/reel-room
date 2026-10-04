"use server";

import { and, eq, gt, inArray, isNotNull, isNull, like, or } from "drizzle-orm";
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
  shareLinkFiles,
  shareLinks,
  user,
} from "@/db/schema";
import { auth, isAdmin, requireSession } from "@/lib/auth";
import { headObject, presignUploadRequest, thumbKey } from "@/lib/r2";
import {
  ForbiddenError,
  getEffectiveRole,
  NotFoundError,
  requireFolderRole,
  roleAtLeast,
} from "@/server/permissions";
import { INVITE_TTL_DAYS, newInviteToken, resolveInvitation, sendInviteEmail } from "@/server/invitations";
import { purgeFiles, purgeFolderTree } from "@/server/purge";
import { listFolderMembers } from "@/server/queries";
import { listShareLinks, newShareToken } from "@/server/share-links";

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

const shareLinkSchema = z.object({
  folderId: z.uuid(),
  /** Share just these files (all in `folderId`); omit to share the whole folder. */
  fileIds: z.array(z.uuid()).min(1, "Chọn ít nhất một file").max(500, "Chọn tối đa 500 file").optional(),
  expiresAt: z
    .date()
    .nullable()
    .refine((d) => d === null || d.getTime() > Date.now(), "Thời điểm hết hạn phải ở tương lai")
    .refine(
      (d) => d === null || d.getTime() <= Date.now() + MAX_LINK_DAYS * 86_400_000,
      `Thời hạn tối đa ${MAX_LINK_DAYS} ngày`,
    ),
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

/** The link's creator or a folder owner may revoke it. */
export async function deleteShareLink(linkId: string) {
  const session = await requireSession();
  return run(async () => {
    const [link] = await db
      .select({ folderId: shareLinks.folderId, createdBy: shareLinks.createdBy })
      .from(shareLinks)
      .where(eq(shareLinks.id, z.uuid().parse(linkId)));
    if (!link) throw new NotFoundError("Link không tồn tại");
    const { role } = await requireFolderRole(session, link.folderId, "editor");
    if (link.createdBy !== session.user.id && role !== "owner") {
      throw new ForbiddenError("Chỉ người tạo link hoặc chủ sở hữu folder mới thu hồi được");
    }
    await db.delete(shareLinks).where(eq(shareLinks.id, linkId));
  });
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

export async function trashFile(fileId: string) {
  return run(async () => {
    const session = await requireSession();
    await requireFileRole(fileId, "editor");
    await db
      .update(files)
      .set({ deletedAt: new Date(), deletedBy: session.user.id })
      .where(eq(files.id, fileId));
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

export async function restoreFile(fileId: string) {
  return run(async () => {
    const { folder } = await requireTrashedFile(fileId);
    if (folder.deletedAt) {
      throw new ForbiddenError(`Folder “${folder.name}” đang trong thùng rác. Khôi phục folder trước.`);
    }
    await db.update(files).set({ deletedAt: null, deletedBy: null }).where(eq(files.id, fileId));
  });
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

/** Accounts invited before invite links existed: re-send their set-password email. */
export async function resendInvite(userId: string) {
  const session = await requireSession();
  return run(async () => {
    if (!isAdmin(session)) throw new ForbiddenError();
    const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (!target) throw new NotFoundError("User không tồn tại");
    await auth.api.requestPasswordReset({
      body: {
        email: target.email,
        redirectTo: `${process.env.BETTER_AUTH_URL}/reset-password`,
      },
    });
  });
}
