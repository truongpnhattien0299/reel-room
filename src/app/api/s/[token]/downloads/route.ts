import { z } from "zod";
import { ForbiddenError, NotFoundError } from "@/server/permissions";
import { listSharedDownload, signDownload } from "@/server/downloads";
import { countDownload, resolveShareLink } from "@/server/share-links";

const bodySchema = z.object({
  folderId: z.uuid().optional(),
  fileIds: z.array(z.uuid()).min(1).max(5000).optional(),
});

/** Like `/api/downloads`, limited to what the public link exposes. */
export async function POST(req: Request, ctx: RouteContext<"/api/s/[token]/downloads">) {
  const { token } = await ctx.params;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return Response.json({ error: "Link không còn hiệu lực" }, { status: 404 });
  if (!resolved.link.allowDownload) {
    return Response.json({ error: "Link này không cho phép tải về" }, { status: 403 });
  }
  try {
    const body = bodySchema.parse(await req.json());
    const list = await listSharedDownload(resolved.link, resolved.root, body);
    const signed = await signDownload(list);
    await countDownload(resolved.link.id);
    return Response.json(signed);
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 });
    if (err instanceof z.ZodError) return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
    throw err;
  }
}
