"use client";

import AwsS3 from "@uppy/aws-s3";
import Uppy from "@uppy/core";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  isMediaType,
  MAX_CHECK_ITEMS,
  MAX_FILE_SIZE,
  MAX_FILES_PER_BATCH,
  MAX_HASH_SIZE,
} from "@/lib/upload-limits";
import type { DuplicateResult } from "@/server/duplicates";
import { DuplicateDialog, type DuplicateReview } from "./duplicate-dialog";
import { hashFile } from "./hash";
import { extractMediaInfo, type MediaInfo, uploadThumbnailBlob } from "./thumbnail";

/**
 * Uppy derives its own file ids (name/type/size/mtime/relativePath), so our
 * server-side `fileId` travels in meta and every event is mapped through it.
 * `relativePath` is set to `fileId` too, which makes Uppy's id unique per
 * registration: the same file can be uploaded into two folders.
 */
type Meta = { key: string; folderId: string; fileId: string; relativePath: string };

export type UploadStatus = "uploading" | "finishing" | "done" | "error";

export type UploadItem = {
  id: string;
  name: string;
  folderId: string;
  size: number;
  bytesUploaded: number;
  status: UploadStatus;
  error?: string;
};

type UploadContextValue = {
  items: UploadItem[];
  /** Files still being checked for duplicates before they're uploaded. */
  checking: number;
  addFiles: (folderId: string, files: File[]) => Promise<void>;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  clearFinished: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploads() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploads must be used inside <UploadProvider>");
  return ctx;
}

const CHUNK_SIZE = 16 * 1024 * 1024;

/** localStorage flag: upload without looking for duplicates first. */
export const SKIP_DUPLICATE_CHECK_KEY = "rr_skip_dup_check";

export function readSkipDuplicateCheck() {
  try {
    return localStorage.getItem(SKIP_DUPLICATE_CHECK_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSkipDuplicateCheck(skip: boolean) {
  try {
    if (skip) localStorage.setItem(SKIP_DUPLICATE_CHECK_KEY, "1");
    else localStorage.removeItem(SKIP_DUPLICATE_CHECK_KEY);
  } catch {}
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Hashes computed while checking for duplicates, reused when uploading.
const knownHashes = new WeakMap<File, string>();

async function sha256Of(file: File) {
  const known = knownHashes.get(file);
  if (known || file.size > MAX_HASH_SIZE) return known;
  return hashFile(file).catch(() => undefined);
}

/** Asks the server about `entries`, in as many calls as it takes. */
async function checkDuplicates(entries: { key: string; file: File; sha256?: string }[]) {
  const results: Record<string, DuplicateResult> = {};
  for (let i = 0; i < entries.length; i += MAX_CHECK_ITEMS) {
    const items = entries
      .slice(i, i + MAX_CHECK_ITEMS)
      .map(({ key, file, sha256 }) => ({ key, size: file.size, name: file.name, sha256 }));
    const res = await postJson<{ results: Record<string, DuplicateResult> }>("/api/uploads/check", { items });
    Object.assign(results, res.results);
  }
  return results;
}

/** Thumbnail goes straight to R2 through the same signing endpoint. */
async function uploadThumbnail(fileId: string, info: MediaInfo) {
  if (!info.thumb) return false;
  return uploadThumbnailBlob(fileId, info.thumb, () =>
    postJson<{ url: string; headers?: Record<string, string> }>("/api/uploads/sign", {
      method: "PUT",
      key: `thumbs/${fileId}.webp`,
    }),
  );
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [checking, setChecking] = useState(0);
  const [reviews, setReviews] = useState<DuplicateReview[]>([]);
  // Per-file promise resolving once its thumbnail is uploaded (or skipped)
  // and its hash is known (or given up on).
  const sideTasks = useRef(
    new Map<string, Promise<{ info: MediaInfo; hasThumb: boolean; sha256?: string }>>(),
  );

  const patch = useCallback((id: string, update: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...update } : it)));
  }, []);

  // Coalesce router refreshes when many files finish together.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  const [uppy] = useState(() =>
    new Uppy<Meta, Record<string, never>>({ autoProceed: false }).use(AwsS3, {
      limit: 4,
      getChunkSize: () => CHUNK_SIZE,
      allowedMetaFields: false,
      // Key assigned by POST /api/uploads; the signer only accepts that key.
      generateObjectKey: (file) => file.meta.key as string,
      signRequest: (request) => postJson("/api/uploads/sign", request),
    }),
  );

  // Our fileId -> Uppy's file id.
  const uppyIds = useRef(new Map<string, string>());
  const removeFromUppy = useCallback(
    (id: string) => {
      const uppyId = uppyIds.current.get(id);
      if (uppyId && uppy.getFile(uppyId)) uppy.removeFile(uppyId);
      uppyIds.current.delete(id);
    },
    [uppy],
  );

  // Files whose bytes are in R2 but whose /complete call failed; retrying
  // those must not re-upload.
  const uploadedButNotFinalized = useRef(new Set<string>());

  const finalize = useCallback(
    async (id: string) => {
      patch(id, { status: "finishing", error: undefined });
      try {
        const { info, hasThumb, sha256 } = (await sideTasks.current.get(id)) ?? {
          info: { thumb: null },
          hasThumb: false,
        };
        await postJson(`/api/uploads/${id}/complete`, {
          hasThumb,
          sha256,
          width: info.width,
          height: info.height,
          durationMs: info.durationMs,
        });
        sideTasks.current.delete(id);
        uploadedButNotFinalized.current.delete(id);
        removeFromUppy(id);
        patch(id, { status: "done" });
        scheduleRefresh();
      } catch (err) {
        uploadedButNotFinalized.current.add(id);
        patch(id, { status: "error", error: (err as Error).message });
      }
    },
    [patch, removeFromUppy, scheduleRefresh],
  );

  useEffect(() => {
    const onProgress: Parameters<typeof uppy.on<"upload-progress">>[1] = (file, progress) => {
      if (!file) return;
      patch(file.meta.fileId, { bytesUploaded: progress.bytesUploaded ?? 0 });
    };

    const onSuccess: Parameters<typeof uppy.on<"upload-success">>[1] = (file) => {
      if (!file) return;
      patch(file.meta.fileId, { bytesUploaded: file.size ?? 0 });
      void finalize(file.meta.fileId);
    };

    const onError: Parameters<typeof uppy.on<"upload-error">>[1] = (file, error) => {
      if (!file) return;
      patch(file.meta.fileId, { status: "error", error: error.message });
    };

    uppy.on("upload-progress", onProgress);
    uppy.on("upload-success", onSuccess);
    uppy.on("upload-error", onError);
    return () => {
      uppy.off("upload-progress", onProgress);
      uppy.off("upload-success", onSuccess);
      uppy.off("upload-error", onError);
    };
  }, [uppy, patch, finalize]);

  // Stop transfers when leaving the app (e.g. sign-out). Not destroy(): it
  // uninstalls the S3 plugin, and StrictMode runs this cleanup right after
  // the first mount while keeping the same instance.
  useEffect(() => () => uppy.cancelAll(), [uppy]);

  const active = items.some((it) => it.status === "uploading" || it.status === "finishing");
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  const startUploads = useCallback(
    async (folderId: string, accepted: File[]) => {
      if (accepted.length === 0) return;
      for (let i = 0; i < accepted.length; i += MAX_FILES_PER_BATCH) {
        const batch = accepted.slice(i, i + MAX_FILES_PER_BATCH);
        let registered: { fileId: string; key: string }[];
        try {
          ({ files: registered } = await postJson<{ files: { fileId: string; key: string }[] }>(
            "/api/uploads",
            {
              folderId,
              files: batch.map((f) => ({ name: f.name, size: f.size, type: f.type })),
            },
          ));
        } catch (err) {
          toast.error(`Không thể bắt đầu upload: ${(err as Error).message}`);
          return;
        }

        setItems((prev) => [
          ...prev,
          ...batch.map((f, j) => ({
            id: registered[j].fileId,
            name: f.name,
            folderId,
            size: f.size,
            bytesUploaded: 0,
            status: "uploading" as const,
          })),
        ]);

        batch.forEach((file, j) => {
          const { fileId } = registered[j];
          sideTasks.current.set(
            fileId,
            Promise.all([
              extractMediaInfo(file).then(async (info) => ({
                info,
                hasThumb: await uploadThumbnail(fileId, info),
              })),
              // Stored so a later upload of the same bytes is caught for sure.
              sha256Of(file),
            ]).then(([media, sha256]) => ({ ...media, sha256 })),
          );
        });

        batch.forEach((file, j) => {
          const { fileId, key } = registered[j];
          const uppyId = uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
            meta: { key, folderId, fileId, relativePath: fileId },
          });
          uppyIds.current.set(fileId, uppyId);
        });
      }
      void uppy.upload();
    },
    [uppy],
  );

  const reviewId = useRef(0);

  /**
   * Uploads right away whatever can't be a duplicate; the rest is hashed
   * (only files the same size as one already there) and, if it still
   * matches, held for the duplicate dialog.
   */
  const addFiles = useCallback(
    async (folderId: string, input: File[]) => {
      const accepted = input.filter((f) => isMediaType(f.type) && f.size > 0 && f.size <= MAX_FILE_SIZE);
      const skipped = input.length - accepted.length;
      if (skipped > 0) {
        toast.warning(`Bỏ qua ${skipped} file không phải ảnh/video/audio hoặc lớn hơn 5GB`);
      }
      if (accepted.length === 0) return;
      if (readSkipDuplicateCheck()) return startUploads(folderId, accepted);

      const entries = accepted.map((file, i) => ({ key: String(i), file }));
      let pending = entries;
      setChecking((n) => n + entries.length);
      const settle = (done: number) => setChecking((n) => n - done);
      try {
        const bySize = await checkDuplicates(entries);
        const clear = entries.filter((e) => !bySize[e.key].needsHash);
        pending = entries.filter((e) => bySize[e.key].needsHash);
        settle(clear.length);
        void startUploads(folderId, clear.map((e) => e.file));
        if (pending.length === 0) return;

        const hashed = [];
        for (const e of pending) hashed.push({ ...e, sha256: await sha256Of(e.file) });
        for (const e of hashed) if (e.sha256) knownHashes.set(e.file, e.sha256);
        const byHash = await checkDuplicates(hashed);
        const fresh = pending.filter((e) => byHash[e.key].matches.length === 0);
        const dupes = pending.filter((e) => byHash[e.key].matches.length > 0);
        void startUploads(folderId, fresh.map((e) => e.file));
        if (dupes.length) {
          setReviews((prev) => [
            ...prev,
            {
              id: ++reviewId.current,
              folderId,
              entries: dupes.map((e) => ({ file: e.file, matches: byHash[e.key].matches })),
            },
          ]);
        }
      } catch {
        // The check is only a hint; never let it block an upload.
        void startUploads(folderId, pending.map((e) => e.file));
      } finally {
        settle(pending.length);
      }
    },
    [startUploads],
  );

  const resolveReview = useCallback(
    (review: DuplicateReview, upload: File[]) => {
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      const skippedCount = review.entries.length - upload.length;
      if (skippedCount > 0) toast(`Đã bỏ qua ${skippedCount} file trùng`);
      void startUploads(review.folderId, upload);
    },
    [startUploads],
  );

  const cancel = useCallback(
    (id: string) => {
      removeFromUppy(id);
      sideTasks.current.delete(id);
      uploadedButNotFinalized.current.delete(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      void fetch(`/api/uploads/${id}`, { method: "DELETE" });
    },
    [removeFromUppy],
  );

  const retry = useCallback(
    (id: string) => {
      if (uploadedButNotFinalized.current.has(id)) {
        void finalize(id);
        return;
      }
      const uppyId = uppyIds.current.get(id);
      if (!uppyId) return;
      patch(id, { status: "uploading", error: undefined });
      void uppy.retryUpload(uppyId);
    },
    [uppy, patch, finalize],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.status !== "done"));
  }, []);

  const value = useMemo(
    () => ({ items, checking, addFiles, cancel, retry, clearFinished }),
    [items, checking, addFiles, cancel, retry, clearFinished],
  );

  const review = reviews[0];
  return (
    <UploadContext.Provider value={value}>
      {children}
      {review && (
        <DuplicateDialog key={review.id} review={review} onResolve={(files) => resolveReview(review, files)} />
      )}
    </UploadContext.Provider>
  );
}
