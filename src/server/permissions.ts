import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { folderPermissions, folders, type Folder, type FolderRole } from "@/db/schema";
import type { Session } from "@/lib/auth";

const RANK: Record<FolderRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function roleAtLeast(role: FolderRole | null, min: FolderRole) {
  return role !== null && RANK[role] >= RANK[min];
}

export const ancestorIds = (folder: Pick<Folder, "path">) => folder.path.split("/");

/**
 * Highest role the user holds on `folder` through a grant on it or any
 * ancestor. Admins are treated as owners everywhere.
 */
export async function getEffectiveRole(
  session: Session,
  folder: Pick<Folder, "path">,
): Promise<FolderRole | null> {
  return getUserRole(session.user, folder);
}

/** Same as `getEffectiveRole`, for a user other than the current one. */
export async function getUserRole(
  u: { id: string; role?: string | null },
  folder: Pick<Folder, "path">,
): Promise<FolderRole | null> {
  if (u.role === "admin") return "owner";
  const grants = await db
    .select({ role: folderPermissions.role })
    .from(folderPermissions)
    .where(
      and(
        eq(folderPermissions.userId, u.id),
        inArray(folderPermissions.folderId, ancestorIds(folder)),
      ),
    );
  let best: FolderRole | null = null;
  for (const { role } of grants) {
    if (!roleAtLeast(best, role)) best = role;
  }
  return best;
}

export class ForbiddenError extends Error {
  constructor(message = "Bạn không có quyền thực hiện thao tác này") {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(message = "Không tìm thấy") {
    super(message);
  }
}

/** Load a live folder and assert the user holds at least `min` on it. */
export async function requireFolderRole(
  session: Session,
  folderId: string,
  min: FolderRole,
) {
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), isNull(folders.deletedAt)));
  if (!folder) throw new NotFoundError("Folder không tồn tại");
  const role = await getEffectiveRole(session, folder);
  // Hide existence from users with no access at all.
  if (role === null) throw new NotFoundError("Folder không tồn tại");
  if (!roleAtLeast(role, min)) throw new ForbiddenError();
  return { folder, role };
}
