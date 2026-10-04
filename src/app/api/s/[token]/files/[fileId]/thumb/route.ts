import { presignRead } from "@/lib/r2";
import { redirectToSigned } from "@/server/file-access";
import { findSharedFile, resolveShareLink } from "@/server/share-links";

export async function GET(_req: Request, ctx: RouteContext<"/api/s/[token]/files/[fileId]/thumb">) {
  const { token, fileId } = await ctx.params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return Response.json({ error: "Link không còn hiệu lực" }, { status: 404 });
  const file = await findSharedFile(resolved.link, resolved.root, fileId);
  if (!file?.thumbKey) return Response.json({ error: "No thumbnail" }, { status: 404 });
  return redirectToSigned(await presignRead(file.thumbKey, { contentType: "image/webp" }));
}
