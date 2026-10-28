import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import { headObject, thumbKey } from "@/lib/r2";
import { logActivity } from "@/server/activity";
import { NotFoundError } from "@/server/permissions";
import { withSession } from "@/server/route-utils";

const bodySchema = z.object({
  hasThumb: z.boolean(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

/** Marks a file ready once its object is confirmed to be in R2. */
export const POST = withSession(async (req, session, ctx: RouteContext<"/api/uploads/[fileId]/complete">) => {
  const { fileId } = await ctx.params;
  const body = bodySchema.parse(await req.json());

  const [row] = await db
    .select({ file: files, folder: { id: folders.id, path: folders.path, name: folders.name } })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(
      and(
        eq(files.id, fileId),
        eq(files.uploadedBy, session.user.id),
        eq(files.status, "uploading"),
      ),
    );
  if (!row) throw new NotFoundError("Upload not found");
  const { file, folder } = row;

  const object = await headObject(file.r2Key);
  if (!object || object.size !== file.size) {
    return Response.json({ error: "Upload chưa hoàn tất trên storage" }, { status: 409 });
  }
  const thumb = body.hasThumb && (await headObject(thumbKey(file.id))) ? thumbKey(file.id) : null;

  // One row per file; the activity list folds runs of uploads together.
  await db.batch([
    db
      .update(files)
      .set({
        status: "ready",
        thumbKey: thumb,
        width: body.width,
        height: body.height,
        durationMs: body.durationMs,
      })
      .where(eq(files.id, file.id)),
    logActivity(session, "file.upload", {
      folder,
      meta: { names: [file.name], count: 1, folderName: folder.name },
    }),
  ]);

  return Response.json({ ok: true });
});
