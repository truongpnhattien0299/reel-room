import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const Bucket = process.env.R2_BUCKET!;

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // R2 rejects the CRC32 checksum headers newer SDKs add by default.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/** How long upload URLs stay valid. One URL is signed per part, so keep it short. */
const UPLOAD_URL_TTL = 15 * 60;
/** How long view/download URLs stay valid. Long enough to watch a long video. */
const READ_URL_TTL = 60 * 60;

export const originalKey = (fileId: string) => `files/${fileId}`;
export const thumbKey = (fileId: string) => `thumbs/${fileId}.webp`;

/**
 * Presign the S3 request Uppy's S3 client is about to make. The caller is
 * responsible for checking that the user may write `key`.
 */
export async function presignUploadRequest(
  req:
    | { op: "putObject"; key: string; contentType: string }
    | { op: "createMultipartUpload"; key: string; contentType: string }
    | { op: "uploadPart"; key: string; uploadId: string; partNumber: number }
    | { op: "listParts"; key: string; uploadId: string }
    | { op: "completeMultipartUpload"; key: string; uploadId: string }
    | { op: "abortMultipartUpload"; key: string; uploadId: string },
) {
  const opts = { expiresIn: UPLOAD_URL_TTL };
  switch (req.op) {
    case "putObject":
      return getSignedUrl(
        r2,
        new PutObjectCommand({ Bucket, Key: req.key, ContentType: req.contentType }),
        { ...opts, signableHeaders: new Set(["content-type"]) },
      );
    case "createMultipartUpload":
      return getSignedUrl(
        r2,
        new CreateMultipartUploadCommand({
          Bucket,
          Key: req.key,
          ContentType: req.contentType,
        }),
        { ...opts, signableHeaders: new Set(["content-type"]) },
      );
    case "uploadPart":
      return getSignedUrl(
        r2,
        new UploadPartCommand({
          Bucket,
          Key: req.key,
          UploadId: req.uploadId,
          PartNumber: req.partNumber,
        }),
        opts,
      );
    case "listParts":
      return getSignedUrl(
        r2,
        new ListPartsCommand({ Bucket, Key: req.key, UploadId: req.uploadId }),
        opts,
      );
    case "completeMultipartUpload":
      return getSignedUrl(
        r2,
        new CompleteMultipartUploadCommand({
          Bucket,
          Key: req.key,
          UploadId: req.uploadId,
        }),
        opts,
      );
    case "abortMultipartUpload":
      return getSignedUrl(
        r2,
        new AbortMultipartUploadCommand({
          Bucket,
          Key: req.key,
          UploadId: req.uploadId,
        }),
        opts,
      );
  }
}

export async function presignRead(
  key: string,
  opts: { downloadName?: string; contentType?: string } = {},
) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentType: opts.contentType,
      ResponseContentDisposition: opts.downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
        : undefined,
    }),
    { expiresIn: READ_URL_TTL },
  );
}

/** Returns object size in bytes, or null if the object doesn't exist. */
export async function headObject(key: string) {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket, Key: key }));
    return { size: res.ContentLength ?? 0 };
  } catch (err) {
    if ((err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket, Key: key }));
}
