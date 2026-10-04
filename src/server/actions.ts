"use server";

import { and, eq, inArray, isNotNull, isNull, like, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { files, folderPermissions, folders, user } from "@/db/schema";
import { auth, isAdmin, requireSession } from "@/lib/auth";
import {
  ForbiddenError,
  getEffectiveRole,
  NotFoundError,
  requireFolderRole,
  roleAtLeast,
} from "@/server/permissions";
import { purgeFiles, purgeFolderTree } from "@/server/purge";
import { listFolderMembers } from "@/server/queries";

export type ActionResult = { error?: string };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Tên không được để trống")
  .max(200, "Tên quá dài")
  .refine((s) => !s.includes("/"), "Tên không được chứa ký tự /");

/** Turns expected failures into `{ error }` so forms can show them. */
async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return {};
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
  name: z.string().trim().min(1, "Nhập tên"),
  email: z.email("Email không hợp lệ").transform((s) => s.toLowerCase()),
  role: z.enum(["user", "admin"]),
});

/**
 * Creates the account without a password, then sends a reset-password link
 * which doubles as the invite: setting a password creates the credential.
 */
export async function inviteUser(input: z.input<typeof inviteSchema>) {
  const session = await requireSession();
  return run(async () => {
    if (!isAdmin(session)) throw new ForbiddenError();
    const { name, email, role } = inviteSchema.parse(input);
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) throw new ForbiddenError("Email này đã có tài khoản");
    await auth.api.createUser({ body: { email, name, role }, headers: await headers() });
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${process.env.BETTER_AUTH_URL}/reset-password` },
    });
  });
}

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
