"use client";

import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/format";
import type { FileItem } from "@/server/queries";
import { contentUrl, downloadUrl } from "./file-card";

export function MediaPreview({
  files,
  index,
  onIndexChange,
}: {
  files: FileItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const file = index === null ? null : files[index];
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < files.length - 1;

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < files.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onIndexChange]);

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="flex h-[90svh] max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-6xl">
        {file && (
          <>
            <div className="flex items-center gap-2 pr-8">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{file.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={downloadUrl(file.id)} />}
              >
                <DownloadIcon data-icon="inline-start" />
                Tải về
              </Button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-lg bg-black">
              {file.mimeType.startsWith("video/") ? (
                <video
                  key={file.id}
                  src={contentUrl(file.id)}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={file.id}
                  src={contentUrl(file.id)}
                  alt={file.name}
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {hasPrev && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Trước"
                  className="absolute left-2"
                  onClick={() => onIndexChange(index! - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
              )}
              {hasNext && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Sau"
                  className="absolute right-2"
                  onClick={() => onIndexChange(index! + 1)}
                >
                  <ChevronRightIcon />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
