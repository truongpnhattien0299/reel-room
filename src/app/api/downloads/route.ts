import { z } from "zod";
import { listFilesDownload, listFolderDownload, signDownload } from "@/server/downloads";
import { withSession } from "@/server/route-utils";

const bodySchema = z.union([
  z.object({ folderId: z.uuid() }),
  z.object({ fileIds: z.array(z.uuid()).min(1).max(5000) }),
]);

/**
 * Lists a folder (with subfolders) or picked files as signed R2 URLs. The
 * browser downloads and zips them itself: files never pass through here.
 */
export const POST = withSession(async (req, session) => {
  const body = bodySchema.parse(await req.json());
  const list =
    "folderId" in body
      ? await listFolderDownload(session, body.folderId)
      : await listFilesDownload(session, body.fileIds);
  return Response.json(await signDownload(list));
});
