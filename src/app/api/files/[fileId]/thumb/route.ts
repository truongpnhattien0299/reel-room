import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import { presignRead } from "@/lib/r2";
import { getEffectiveRole, NotFoundError, roleAtLeast } from "@/server/permissions";
import { redirectToSigned } from "@/server/file-access";
import { withSession } from "@/server/route-utils";

/**
 * Thumbnails also serve trashed files (for the trash page), but only to
 * people who can edit there, i.e. who could restore them.
 */
export const GET = withSession(async (_req, session, ctx: RouteContext<"/api/files/[fileId]/thumb">) => {
  const { fileId } = await ctx.params;
  const [row] = await db
    .select({ thumbKey: files.thumbKey, deletedAt: files.deletedAt, path: folders.path, folderDeletedAt: folders.deletedAt })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(eq(files.id, fileId), eq(files.status, "ready")));
  if (!row?.thumbKey) throw new NotFoundError("No thumbnail");

  const trashed = row.deletedAt !== null || row.folderDeletedAt !== null;
  const role = await getEffectiveRole(session, row);
  if (!roleAtLeast(role, trashed ? "editor" : "viewer")) throw new NotFoundError("No thumbnail");

  return redirectToSigned(await presignRead(row.thumbKey, { contentType: "image/webp" }));
});
