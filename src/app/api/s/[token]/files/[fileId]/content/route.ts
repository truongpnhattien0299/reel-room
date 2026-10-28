import { presignRead } from "@/lib/r2";
import { redirectToSigned } from "@/server/file-access";
import { countDownload, findSharedFile, resolveShareLink } from "@/server/share-links";

/**
 * Original file through a public link. `?download=1` forces a download, unless
 * the link turned downloads off (viewing still works).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/s/[token]/files/[fileId]/content">) {
  const { token, fileId } = await ctx.params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return Response.json({ error: "Link không còn hiệu lực" }, { status: 404 });
  const { link, root } = resolved;
  const download = new URL(req.url).searchParams.has("download");
  if (download && !link.allowDownload) {
    return Response.json({ error: "Link này không cho phép tải về" }, { status: 403 });
  }
  const file = await findSharedFile(link, root, fileId);
  if (!file) return Response.json({ error: "File không tồn tại" }, { status: 404 });
  if (download) await countDownload(link.id);
  const url = await presignRead(file.r2Key, {
    contentType: file.mimeType,
    downloadName: download ? file.name : undefined,
  });
  return redirectToSigned(url);
}
