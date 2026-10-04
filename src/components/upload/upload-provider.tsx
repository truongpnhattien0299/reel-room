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
import { isMediaType, MAX_FILE_SIZE, MAX_FILES_PER_BATCH } from "@/lib/upload-limits";
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
  // Per-file promise resolving once its thumbnail is uploaded (or skipped).
  const sideTasks = useRef(new Map<string, Promise<{ info: MediaInfo; hasThumb: boolean }>>());

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
        const { info, hasThumb } = (await sideTasks.current.get(id)) ?? {
          info: { thumb: null },
          hasThumb: false,
        };
        await postJson(`/api/uploads/${id}/complete`, {
          hasThumb,
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

  const addFiles = useCallback(
    async (folderId: string, input: File[]) => {
      const accepted = input.filter((f) => isMediaType(f.type) && f.size > 0 && f.size <= MAX_FILE_SIZE);
      const skipped = input.length - accepted.length;
      if (skipped > 0) {
        toast.warning(`Bỏ qua ${skipped} file không phải ảnh/video hoặc lớn hơn 5GB`);
      }

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
            extractMediaInfo(file).then(async (info) => ({
              info,
              hasThumb: await uploadThumbnail(fileId, info),
            })),
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
    () => ({ items, addFiles, cancel, retry, clearFinished }),
    [items, addFiles, cancel, retry, clearFinished],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}
