import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { NotFoundError, requireFolderRole } from "@/server/permissions";

/** A ready, non-trashed file the user may view. */
export async function requireReadableFile(session: Session, fileId: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.status, "ready"), isNull(files.deletedAt)));
  if (!file) throw new NotFoundError("File không tồn tại");
  await requireFolderRole(session, file.folderId, "viewer");
  return file;
}

/**
 * Redirect to a short-lived signed R2 URL. The browser caches the redirect for
 * a while (shorter than the URL lifetime) so grids don't re-sign on every view.
 */
export function redirectToSigned(url: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=1800" },
  });
}
