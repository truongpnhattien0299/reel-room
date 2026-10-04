import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { presignUploadRequest } from "@/lib/r2";
import { ForbiddenError } from "@/server/permissions";
import { withSession } from "@/server/route-utils";

// Shape of Uppy's PresignableRequest (@uppy/aws-s3 s3-client/types).
const bodySchema = z.object({
  method: z.enum(["GET", "PUT", "POST", "DELETE"]),
  key: z.string(),
  uploadId: z.string().optional(),
  partNumber: z.number().int().min(1).max(10_000).optional(),
});

const KEY_PATTERN = /^(files\/([0-9a-f-]{36})|thumbs\/([0-9a-f-]{36})\.webp)$/;

/**
 * Signs one S3 request for the browser. Only keys of files the caller
 * registered and hasn't finished uploading can be signed.
 */
export const POST = withSession(async (req, session) => {
  const { method, key, uploadId, partNumber } = bodySchema.parse(await req.json());

  const match = KEY_PATTERN.exec(key);
  if (!match) throw new ForbiddenError("Invalid key");
  const fileId = match[2] ?? match[3];
  const isThumb = match[3] !== undefined;

  const [file] = await db
    .select({ mimeType: files.mimeType })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.uploadedBy, session.user.id),
        eq(files.status, "uploading"),
      ),
    );
  if (!file) throw new ForbiddenError("Upload not found");
  const contentType = isThumb ? "image/webp" : file.mimeType;

  let url: string;
  if (!uploadId) {
    if (method === "PUT") {
      url = await presignUploadRequest({ op: "putObject", key, contentType });
    } else if (method === "POST" && !isThumb) {
      url = await presignUploadRequest({ op: "createMultipartUpload", key, contentType });
    } else {
      throw new ForbiddenError("Unsupported request");
    }
    return Response.json({ url, headers: { "Content-Type": contentType } });
  }

  if (method === "PUT" && partNumber) {
    url = await presignUploadRequest({ op: "uploadPart", key, uploadId, partNumber });
  } else if (method === "GET") {
    url = await presignUploadRequest({ op: "listParts", key, uploadId });
  } else if (method === "POST") {
    url = await presignUploadRequest({ op: "completeMultipartUpload", key, uploadId });
  } else if (method === "DELETE") {
    url = await presignUploadRequest({ op: "abortMultipartUpload", key, uploadId });
  } else {
    throw new ForbiddenError("Unsupported request");
  }
  return Response.json({ url });
});
