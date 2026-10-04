/** Shared by the upload UI and the upload API. */
export const MAX_FILE_SIZE = 5 * 1024 ** 3; // 5 GiB
export const MAX_FILES_PER_BATCH = 200;

export const isMediaType = (mime: string) =>
  mime.startsWith("image/") || mime.startsWith("video/");
