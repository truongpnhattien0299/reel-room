import { presignRead } from "@/lib/r2";
import { redirectToSigned } from "@/server/file-access";
import { findSharedFile, resolveShareLink } from "@/server/share-links";

/** Original file through a public link. `?download=1` forces a download. */
export async function GET(req: Request, ctx: RouteContext<"/api/s/[token]/files/[fileId]/content">) {
  const { token, fileId } = await ctx.params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return Response.json({ error: "Link không còn hiệu lực" }, { status: 404 });
  const file = await findSharedFile(resolved.link, resolved.root, fileId);
  if (!file) return Response.json({ error: "File không tồn tại" }, { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const url = await presignRead(file.r2Key, {
    contentType: file.mimeType,
    downloadName: download ? file.name : undefined,
  });
  return redirectToSigned(url);
}
