"use client";

import { Link2Icon, ListChecksIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isVideo } from "@/lib/media";
import { cn } from "@/lib/utils";
import { renameFile, trashFile } from "@/server/actions";
import type { FileItem } from "@/server/queries";
import { ConfirmDialog } from "./confirm-dialog";
import { FileCard } from "./file-card";
import { MediaPreview } from "./media-preview";
import { NameDialog } from "./name-dialog";
import { ShareFilesDialog } from "./share-links";

type Filter = "all" | "image" | "video";

export function FileGrid({
  files,
  canEdit,
  shareFolderId,
  folderName,
  initialFileId,
}: {
  files: FileItem[];
  canEdit: boolean;
  /** Lets the user pick files and share them by link (they live in this folder). */
  shareFolderId?: string;
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
  // Null when not picking files to share.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  // "done" once the link exists: closing the dialog then ends the selection.
  const [sharing, setSharing] = useState<"open" | "done" | null>(null);

  const videoCount = files.filter(isVideo).length;
  const counts = { all: files.length, image: files.length - videoCount, video: videoCount };
  const visible =
    filter === "all" ? files : files.filter((f) => (filter === "video") === isVideo(f));
  const previewIndex = previewId ? visible.findIndex((f) => f.id === previewId) : -1;

  // Files that left the folder (trashed elsewhere) drop out of the selection.
  const picked = selected ? files.filter((f) => selected.has(f.id)).map((f) => f.id) : [];
  const allVisiblePicked = selected !== null && visible.every((f) => selected.has(f.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (selected === null || sharing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, sharing]);

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
                "flex h-9 items-center gap-1.5 rounded-[calc(var(--radius-xl)-0.25rem)] px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        {shareFolderId &&
          (selected === null ? (
            <Button variant="outline" size="lg" onClick={() => setSelected(new Set())}>
              <ListChecksIcon data-icon="inline-start" />
              Chọn
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              onClick={() =>
                setSelected(
                  allVisiblePicked
                    ? new Set([...selected].filter((id) => !visible.some((f) => f.id === id)))
                    : new Set([...selected, ...visible.map((f) => f.id)]),
                )
              }
            >
              {allVisiblePicked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </Button>
          ))}
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
              selected={selected ? selected.has(f.id) : undefined}
              onOpen={() => (selected ? toggle(f.id) : setPreviewId(f.id))}
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

      {selected && shareFolderId && (
        <div
          role="toolbar"
          aria-label="File đã chọn"
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-popover py-2 pr-2 pl-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-[#2a2e37] sm:bottom-8"
        >
          <span className="pr-2 text-sm whitespace-nowrap">
            <span className="font-mono font-semibold">{picked.length}</span> đã chọn
          </span>
          <Button size="lg" disabled={picked.length === 0} onClick={() => setSharing("open")}>
            <Link2Icon data-icon="inline-start" />
            Tạo link
          </Button>
          <Button variant="ghost" size="icon-lg" aria-label="Thoát chế độ chọn" onClick={() => setSelected(null)}>
            <XIcon />
          </Button>
        </div>
      )}
      {sharing && shareFolderId && (
        <ShareFilesDialog
          open
          folderId={shareFolderId}
          fileIds={picked}
          onCreated={() => setSharing("done")}
          onOpenChange={(open) => {
            if (open) return;
            if (sharing === "done") setSelected(null);
            setSharing(null);
          }}
        />
      )}
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
