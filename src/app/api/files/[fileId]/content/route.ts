import { presignRead } from "@/lib/r2";
import { redirectToSigned, requireReadableFile } from "@/server/file-access";
import { withSession } from "@/server/route-utils";

/** Original file. `?download=1` forces a download with the original name. */
export const GET = withSession(async (req, session, ctx: RouteContext<"/api/files/[fileId]/content">) => {
  const { fileId } = await ctx.params;
  const file = await requireReadableFile(session, fileId);
  const download = new URL(req.url).searchParams.has("download");
  const url = await presignRead(file.r2Key, {
    contentType: file.mimeType,
    downloadName: download ? file.name : undefined,
  });
  return redirectToSigned(url);
});
