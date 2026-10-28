import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { files, folderPermissions, folders, shareLinkFiles, shareLinks, user, type FolderRole } from "@/db/schema";
import type { Session } from "@/lib/auth";

type User = typeof user.$inferSelect;

let seq = 0;
const next = () => ++seq;

export async function makeUser(opts: { role?: "admin" | "user"; banned?: boolean; name?: string } = {}) {
  const n = next();
  const [row] = await db
    .insert(user)
    .values({
      id: `user-${n}`,
      name: opts.name ?? `User ${n}`,
      email: `user${n}@test.local`,
      role: opts.role ?? "user",
      banned: opts.banned ?? false,
    })
    .returning();
  return row;
}

/** A session for `u`, with only the fields the app reads. */
export function sessionFor(u: Pick<User, "id" | "role">) {
  return { user: { id: u.id, role: u.role }, session: {} } as unknown as Session;
}

export async function makeFolder(
  owner: Pick<User, "id">,
  opts: { parent?: { id: string; path: string }; name?: string } = {},
) {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(folders)
    .values({
      id,
      name: opts.name ?? `Folder ${next()}`,
      parentId: opts.parent?.id ?? null,
      path: opts.parent ? `${opts.parent.path}/${id}` : id,
      createdBy: owner.id,
    })
    .returning();
  return row;
}

export async function grant(u: Pick<User, "id">, folder: { id: string }, role: FolderRole) {
  await db.insert(folderPermissions).values({ folderId: folder.id, userId: u.id, role });
}

export async function makeFile(
  folder: { id: string },
  uploader: Pick<User, "id">,
  opts: {
    name?: string;
    size?: number;
    mimeType?: string;
    status?: "uploading" | "ready";
    createdAt?: Date;
    deletedAt?: Date;
  } = {},
) {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(files)
    .values({
      id,
      folderId: folder.id,
      name: opts.name ?? `file-${next()}.jpg`,
      mimeType: opts.mimeType ?? "image/jpeg",
      size: opts.size ?? 1000,
      r2Key: `files/${id}`,
      status: opts.status ?? "ready",
      uploadedBy: uploader.id,
      createdAt: opts.createdAt,
      deletedAt: opts.deletedAt,
    })
    .returning();
  return row;
}

export async function makeShareLink(
  folder: { id: string },
  creator: Pick<User, "id">,
  opts: { expiresAt?: Date | null; fileIds?: string[] } = {},
) {
  const [link] = await db
    .insert(shareLinks)
    .values({
      token: randomBytes(24).toString("base64url"),
      kind: opts.fileIds ? "files" : "folder",
      folderId: folder.id,
      expiresAt: opts.expiresAt ?? null,
      createdBy: creator.id,
    })
    .returning();
  if (opts.fileIds?.length) {
    await db.insert(shareLinkFiles).values(opts.fileIds.map((fileId) => ({ linkId: link.id, fileId })));
  }
  return link;
}
