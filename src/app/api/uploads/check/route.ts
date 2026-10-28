import { z } from "zod";
import { MAX_CHECK_ITEMS, MAX_FILE_SIZE } from "@/lib/upload-limits";
import { checkDuplicates } from "@/server/duplicates";
import { withSession } from "@/server/route-utils";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        size: z.number().int().positive().max(MAX_FILE_SIZE),
        name: z.string().trim().min(1).max(255),
        sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
      }),
    )
    .min(1)
    .max(MAX_CHECK_ITEMS),
});

/**
 * Before an upload: which of these files the user can already see. Call once
 * with sizes only, then again with hashes for the items that `needsHash`.
 */
export const POST = withSession(async (req, session) => {
  const { items } = bodySchema.parse(await req.json());
  return Response.json({ results: await checkDuplicates(session, items) });
});
