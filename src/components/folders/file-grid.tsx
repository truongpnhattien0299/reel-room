"use client";

import { useState } from "react";
import { isVideo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { renameFile, trashFile } from "@/server/actions";
import type { FileItem } from "@/server/queries";
import { ConfirmDialog } from "./confirm-dialog";
import { FileCard } from "./file-card";
import { MediaPreview } from "./media-preview";
import { NameDialog } from "./name-dialog";

type Filter = "all" | "image" | "video";

export function FileGrid({
  files,
  canEdit,
  folderName,
  initialFileId,
}: {
  files: FileItem[];
  canEdit: boolean;
  folderName: string;
  /** Open this file in the viewer on load (links from "recent uploads"). */
  initialFileId?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [previewId, setPreviewId] = useState<string | null>(
    initialFileId && files.some((f) => f.id === initialFileId) ? initialFileId : null,
  );
  const [renaming, setRenaming] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);

  const videoCount = files.filter(isVideo).length;
  const counts = { all: files.length, image: files.length - videoCount, video: videoCount };
  const visible =
    filter === "all" ? files : files.filter((f) => (filter === "video") === isVideo(f));
  const previewIndex = previewId ? visible.findIndex((f) => f.id === previewId) : -1;

  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "image", label: "Ảnh" },
    { value: "video", label: "Video" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2229] pb-3">
        <div
          role="group"
          aria-label="Lọc theo loại"
          className="flex gap-1 rounded-xl bg-card p-1 ring-1 ring-border"
        >
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={filter === c.value}
              onClick={() => setFilter(c.value)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === c.value
                  ? "bg-[#2a2e37] font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
              <span className="font-mono text-[11px] text-muted-foreground">{counts[c.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Không có {filter === "video" ? "video" : "ảnh"} nào trong folder này.
        </p>
      ) : (
        <div className="columns-2 gap-3.5 sm:columns-[220px]">
          {visible.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onOpen={() => setPreviewId(f.id)}
              onRename={canEdit ? () => setRenaming(f) : undefined}
              onDelete={canEdit ? () => setDeleting(f) : undefined}
            />
          ))}
        </div>
      )}

      <MediaPreview
        files={visible}
        folderName={folderName}
        index={previewIndex === -1 ? null : previewIndex}
        onIndexChange={(i) => setPreviewId(i === null ? null : visible[i].id)}
        onRename={canEdit ? (f) => setRenaming(f) : undefined}
        onDelete={canEdit ? (f) => setDeleting(f) : undefined}
      />

      {renaming && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title="Đổi tên file"
          submitLabel="Lưu"
          defaultValue={renaming.name}
          onSubmit={(name) => renameFile(renaming.id, name)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          // The viewer closes by itself once the trashed file drops out of the list.
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xoá “${deleting.name}”?`}
          description="File sẽ được chuyển vào thùng rác."
          confirmLabel="Xoá"
          onConfirm={() => trashFile(deleting.id)}
        />
      )}
    </>
  );
}
