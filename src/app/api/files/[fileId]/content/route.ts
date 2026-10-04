import { presignRead } from "@/lib/r2";
import { redirectToSigned, requireReadableFile } from "@/server/file-access";
import { withSession } from "@/server/route-utils";

/**
 * Original file. `?download=1` forces a download with the original name;
 * `?fresh=1` skips caching (for CORS reads that draw it onto a canvas).
 */
export const GET = withSession(async (req, session, ctx: RouteContext<"/api/files/[fileId]/content">) => {
  const { fileId } = await ctx.params;
  const file = await requireReadableFile(session, fileId);
  const params = new URL(req.url).searchParams;
  const noStore = params.has("fresh");
  const url = await presignRead(file.r2Key, {
    contentType: file.mimeType,
    downloadName: params.has("download") ? file.name : undefined,
    noStore,
  });
  return redirectToSigned(url, { noStore });
});
