"use client";

import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { downloadZip, ZipCancelled, type ZipProgress } from "@/lib/zip-download";

function ProgressLine({ p }: { p: ZipProgress }) {
  return (
    <span className="flex flex-col gap-1.5 pt-1">
      <span className="font-mono text-xs">
        {p.files}/{p.totalFiles} file · {formatBytes(p.bytes)}/{formatBytes(p.totalBytes)}
      </span>
      <Progress value={p.totalBytes ? (p.bytes / p.totalBytes) * 100 : 0} aria-label="Tiến trình nén" />
    </span>
  );
}

/** Zips what `body` names through `endpoint`, with progress and Cancel in a toast. */
export async function startZipDownload(endpoint: string, body: object, suggestedName: string) {
  const id = `zip-${crypto.randomUUID()}`;
  const controller = new AbortController();
  const cancel = { label: "Huỷ", onClick: () => controller.abort() };
  try {
    await downloadZip(endpoint, body, {
      suggestedName,
      signal: controller.signal,
      onProgress: (p) =>
        toast.loading(`Đang nén ${suggestedName}`, {
          id,
          description: <ProgressLine p={p} />,
          action: cancel,
          duration: Infinity,
        }),
    });
    toast.success(`Đã tải ${suggestedName}`, { id, description: null, action: null, duration: 4000 });
  } catch (err) {
    if (err instanceof ZipCancelled) {
      toast.dismiss(id);
      return;
    }
    toast.error((err as Error).message || "Tải về thất bại", { id, description: null, action: null, duration: 6000 });
  }
}
