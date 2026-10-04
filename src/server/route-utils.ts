import "server-only";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/server/permissions";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Wraps a route handler with session checking and error-to-status mapping. */
export function withSession<Ctx>(
  handler: (req: Request, session: Session, ctx: Ctx) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx) => {
    const session = await getSession();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
      return await handler(req, session, ctx);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return Response.json({ error: err.message }, { status: 404 });
      }
      if (err instanceof ForbiddenError) {
        return Response.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof z.ZodError) {
        return Response.json({ error: err.issues[0]?.message ?? "Bad request" }, { status: 400 });
      }
      throw err;
    }
  };
}
