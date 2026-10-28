/** Shared by the upload UI and the upload API. */
export const MAX_FILE_SIZE = 5 * 1024 ** 3; // 5 GiB
export const MAX_FILES_PER_BATCH = 200;
/** Items per call to /api/uploads/check. */
export const MAX_CHECK_ITEMS = 1000;
/** Bigger files aren't hashed in the browser; it takes too long. */
export const MAX_HASH_SIZE = 4 * 1024 ** 3;

export const isMediaType = (mime: string) =>
  mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
