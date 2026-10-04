"use client";

import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUploads } from "./upload-provider";

const ACCEPT = "image/*,video/*";

/** Drop files anywhere over the folder view to upload them into it. */
export function FolderDropzone({
  folderId,
  enabled,
  children,
}: {
  folderId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { addFiles } = useUploads();
  const [dragging, setDragging] = useState(false);
  // dragenter/leave fire for every child element; count to know when we truly left.
  const depth = useRef(0);

  if (!enabled) return <>{children}</>;

  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  return (
    <div
      className="relative min-h-full"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        void addFiles(folderId, Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-stage/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <UploadIcon className="size-8" />
            <p className="font-display text-xl font-semibold">Thả file để upload vào folder này</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function UploadButton({ folderId }: { folderId: string }) {
  const { addFiles } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="xl" className="font-semibold" onClick={() => input.current?.click()}>
        <UploadIcon data-icon="inline-start" />
        Upload
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void addFiles(folderId, files);
        }}
      />
    </>
  );
}
