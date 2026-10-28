"use client";

import { FolderInputIcon, Link2Icon, ListChecksIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MediaViewer } from "@/components/viewer/media-viewer";
import { type MediaKind, mediaKind } from "@/lib/media";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { cn } from "@/lib/utils";
import { renameFile, restoreFiles, trashFile, trashFiles } from "@/server/actions";
import type { FileItem } from "@/server/queries";
import { ConfirmDialog } from "./confirm-dialog";
import { FileCard } from "./file-card";
import { MoveDialog } from "./move-dialog";
import { NameDialog } from "./name-dialog";
import { SelectionToolbar, type ToolbarAction } from "./selection-toolbar";
import { ShareFilesDialog } from "./share-links";
import { backfillThumbnail } from "./thumbnail-backfill";

type Filter = "all" | MediaKind;

const EMPTY_LABEL: Record<Filter, string> = {
  all: "file",
  image: "ảnh",
  video: "video",
  audio: "audio",
};

export function FileGrid({
  files,
  canEdit,
  folderId,
  folderName,
  initialFileId,
}: {
  files: FileItem[];
  canEdit: boolean;
  /**
   * The folder the files sit in. With `canEdit` the user may pick files and
   * move, trash or share them by link.
   */
  folderId?: string;
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
  // `bulk`: the picked files, so a successful move ends the selection.
  const [moving, setMoving] = useState<{ ids: string[]; label: string; bulk?: boolean } | null>(null);
  const [trashing, setTrashing] = useState<string[] | null>(null);
  const canManage = canEdit && folderId !== undefined;
  // Null when not picking files.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  // Anchor for Shift + click ranges.
  const lastClicked = useRef<string | null>(null);
  // "done" once the link exists: closing the dialog then ends the selection.
  const [sharing, setSharing] = useState<"open" | "done" | null>(null);

  const counts: Record<Filter, number> = { all: files.length, image: 0, video: 0, audio: 0 };
  for (const f of files) counts[mediaKind(f)]++;
  const visible = filter === "all" ? files : files.filter((f) => mediaKind(f) === filter);
  const previewIndex = previewId ? visible.findIndex((f) => f.id === previewId) : -1;
  const previewFile = previewIndex === -1 ? null : visible[previewIndex];

  // Opening a file whose thumbnail got lost at upload makes one for the grid.
  useEffect(() => {
    if (canEdit && previewFile && !previewFile.hasThumb && mediaKind(previewFile) !== "audio") {
      void backfillThumbnail(previewFile);
    }
  }, [canEdit, previewFile]);

  // Files that left the folder (trashed elsewhere) drop out of the selection.
  const picked = selected ? files.filter((f) => selected.has(f.id)).map((f) => f.id) : [];
  const allVisiblePicked = selected !== null && visible.every((f) => selected.has(f.id));

  /** Click toggles one file; Shift + click picks every visible file from the last click. */
  function pick(id: string, range: boolean) {
    const from = range && lastClicked.current ? visible.findIndex((f) => f.id === lastClicked.current) : -1;
    const to = visible.findIndex((f) => f.id === id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (from !== -1 && to !== -1) {
        for (const f of visible.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(f.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClicked.current = id;
  }

  function exitSelection() {
    setSelected(null);
    lastClicked.current = null;
  }

  const dialogOpen = sharing !== null || moving !== null || trashing !== null;
  useEffect(() => {
    if (selected === null || dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitSelection();
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if (e.key.toLowerCase() === "a" && (e.metaKey || e.ctrlKey) && !typing) {
        e.preventDefault();
        setSelected((prev) => new Set([...(prev ?? []), ...visible.map((f) => f.id)]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, dialogOpen, visible]);

  async function trashPicked(ids: string[]) {
    const res = await trashFiles(ids);
    if (res.error) return res;
    exitSelection();
    toast.success(`Đã chuyển ${ids.length} file vào thùng rác`, {
      action: {
        label: "Hoàn tác",
        onClick: async () => {
          const undo = await restoreFiles(ids);
          if (undo.error) toast.error(undo.error);
          else toast.success(`Đã khôi phục ${ids.length} file`);
        },
      },
    });
    return res;
  }

  const toolbarActions: ToolbarAction[] = [
    {
      label: "Di chuyển",
      icon: FolderInputIcon,
      primary: true,
      onClick: () => setMoving({ ids: picked, label: `${picked.length} file`, bulk: true }),
    },
    { label: "Tạo link", icon: Link2Icon, primary: true, onClick: () => setSharing("open") },
    { label: "Xoá", icon: Trash2Icon, destructive: true, onClick: () => setTrashing(picked) },
  ];

  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "image", label: "Ảnh" },
    { value: "video", label: "Video" },
    { value: "audio", label: "Audio" },
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
        {canManage &&
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
          Không có {EMPTY_LABEL[filter]} nào trong folder này.
        </p>
      ) : (
        <div className="columns-2 gap-3.5 sm:columns-[220px]">
          {visible.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              selected={selected ? selected.has(f.id) : undefined}
              onOpen={(e) => (selected ? pick(f.id, e.shiftKey) : setPreviewId(f.id))}
              onRename={canEdit ? () => setRenaming(f) : undefined}
              onMove={canManage ? () => setMoving({ ids: [f.id], label: `“${f.name}”` }) : undefined}
              onDelete={canEdit ? () => setDeleting(f) : undefined}
            />
          ))}
        </div>
      )}

      <MediaViewer
        files={visible}
        folderName={folderName}
        index={previewIndex === -1 ? null : previewIndex}
        onIndexChange={(i) => setPreviewId(i === null ? null : visible[i].id)}
        onRename={canEdit ? (f) => setRenaming(f) : undefined}
        onMove={canManage ? (f) => setMoving({ ids: [f.id], label: `“${f.name}”` }) : undefined}
        onDelete={canEdit ? (f) => setDeleting(f) : undefined}
      />

      {selected && canManage && (
        <SelectionToolbar count={picked.length} actions={toolbarActions} onExit={exitSelection} />
      )}
      {sharing && folderId && (
        <ShareFilesDialog
          open
          folderId={folderId}
          fileIds={picked}
          onCreated={() => setSharing("done")}
          onOpenChange={(open) => {
            if (open) return;
            if (sharing === "done") exitSelection();
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
      {moving && folderId && (
        <MoveDialog
          open
          // Like trashing: the viewer moves on once the file drops out of the list.
          onOpenChange={(open) => !open && setMoving(null)}
          items={{ kind: "files", ids: moving.ids, label: moving.label }}
          sourceFolderId={folderId}
          onMoved={moving.bulk ? exitSelection : undefined}
        />
      )}
      {trashing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setTrashing(null)}
          title={`Chuyển ${trashing.length} file vào thùng rác?`}
          description={`Có thể khôi phục trong ${TRASH_RETENTION_DAYS} ngày.`}
          confirmLabel="Xoá"
          onConfirm={() => trashPicked(trashing)}
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
