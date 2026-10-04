const THUMB_MAX = 480;
const VIDEO_TIMEOUT_MS = 15_000;

export type MediaInfo = {
  thumb: Blob | null;
  width?: number;
  height?: number;
  durationMs?: number;
};

// Decoding big images/videos is memory hungry; don't do many at once.
let running = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** Best effort: returns `{ thumb: null }` for formats the browser can't decode. */
export function extractMediaInfo(file: File): Promise<MediaInfo> {
  return withSlot(async () => {
    try {
      if (file.type.startsWith("image/")) return await fromImage(file);
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        try {
          return await fromVideo(url);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      // Unsupported codec/format (e.g. HEIC outside Safari): no thumbnail.
    }
    return { thumb: null };
  });
}

/**
 * Same as `extractMediaInfo`, for a file already in storage. `url` must serve
 * CORS headers, or the canvas is tainted and can't be exported.
 */
export function extractMediaInfoFromUrl(url: string, mimeType: string): Promise<MediaInfo> {
  return withSlot(async () => {
    try {
      if (mimeType.startsWith("image/")) return await fromImageUrl(url);
      if (mimeType.startsWith("video/")) return await fromVideo(url);
    } catch {
      // Undecodable format, or storage without CORS: no thumbnail.
    }
    return { thumb: null };
  });
}

async function fromImage(file: File): Promise<MediaInfo> {
  const bitmap = await createImageBitmap(file);
  try {
    const thumb = await draw(bitmap, bitmap.width, bitmap.height);
    return { thumb, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function fromImageUrl(url: string): Promise<MediaInfo> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const thumb = await draw(img, img.naturalWidth, img.naturalHeight);
  return { thumb, width: img.naturalWidth, height: img.naturalHeight };
}

async function fromVideo(url: string): Promise<MediaInfo> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), VIDEO_TIMEOUT_MS);
      video.onloadedmetadata = () => {
        // Skip black intro frames when the clip is long enough.
        video.currentTime = Math.min(1, video.duration / 10);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("decode"));
      };
      video.src = url;
    });
    const thumb = await draw(video, video.videoWidth, video.videoHeight);
    return {
      thumb,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

// Covers a deploy switching over or a flaky connection; a real misconfiguration
// still fails every attempt and is logged.
const RETRY_DELAYS_MS = [0, 1_000, 3_000];

/**
 * PUTs a thumbnail to storage, signing a fresh URL for each attempt.
 * Resolves to whether it got there.
 */
export async function uploadThumbnailBlob(
  fileId: string,
  thumb: Blob,
  sign: () => Promise<{ url: string; headers?: Record<string, string> }>,
) {
  let lastError = "";
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const { url, headers } = await sign();
      const res = await fetch(url, { method: "PUT", body: thumb, headers });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  console.warn(`[thumbnail] upload failed for ${fileId}: ${lastError}`);
  return false;
}

async function draw(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) return null;
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
}
