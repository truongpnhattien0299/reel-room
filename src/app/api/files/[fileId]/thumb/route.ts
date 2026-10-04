import { presignRead } from "@/lib/r2";
import { NotFoundError } from "@/server/permissions";
import { redirectToSigned, requireReadableFile } from "@/server/file-access";
import { withSession } from "@/server/route-utils";

export const GET = withSession(async (_req, session, ctx: RouteContext<"/api/files/[fileId]/thumb">) => {
  const { fileId } = await ctx.params;
  const file = await requireReadableFile(session, fileId);
  if (!file.thumbKey) throw new NotFoundError("No thumbnail");
  return redirectToSigned(await presignRead(file.thumbKey, { contentType: "image/webp" }));
});
