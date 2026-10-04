import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { originalKey } from "@/lib/r2";
import { isMediaType, MAX_FILE_SIZE, MAX_FILES_PER_BATCH } from "@/lib/upload-limits";
import { requireFolderRole } from "@/server/permissions";
import { withSession } from "@/server/route-utils";

const bodySchema = z.object({
  folderId: z.uuid(),
  files: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
        size: z.number().int().positive().max(MAX_FILE_SIZE, "File vượt quá 5GB"),
        type: z.string().refine(isMediaType, "Chỉ hỗ trợ ảnh và video"),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_BATCH),
});

/**
 * Registers files before they're sent to R2. Returns the object key each file
 * must be uploaded to; /api/uploads/sign only signs requests for those keys.
 */
export const POST = withSession(async (req, session) => {
  const body = bodySchema.parse(await req.json());
  await requireFolderRole(session, body.folderId, "editor");

  const rows = body.files.map((f) => {
    const id = crypto.randomUUID();
    return {
      id,
      folderId: body.folderId,
      name: f.name,
      mimeType: f.type,
      size: f.size,
      r2Key: originalKey(id),
      uploadedBy: session.user.id,
    };
  });
  await db.insert(files).values(rows);

  return Response.json({
    files: rows.map((r) => ({ fileId: r.id, key: r.r2Key })),
  });
});
