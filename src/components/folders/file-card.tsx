"use client";

import { DownloadIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { downloadUrl, isVideo } from "@/lib/media";
import type { FileItem } from "@/server/queries";
import { ItemWithMenu, type MenuAction } from "./item-menu";
import { DurationBadge, MediaThumb } from "./media-thumb";

/** Masonry tile: keeps the media's own aspect ratio when we know it. */
export function FileCard({
  file,
  onOpen,
  onRename,
  onDelete,
}: {
  file: FileItem;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const actions: MenuAction[] = [
    { label: "Tải về", icon: DownloadIcon, onClick: () => window.location.assign(downloadUrl(file.id)) },
  ];
  if (onRename) actions.push({ label: "Đổi tên", icon: PencilIcon, onClick: onRename });
  if (onDelete) {
    actions.push({ label: "Xoá", icon: Trash2Icon, onClick: onDelete, destructive: true });
  }

  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : "1 / 1";

  return (
    <ItemWithMenu actions={actions} className="group/item relative mb-3.5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem ${file.name}`}
        className="block w-full text-left outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-ring"
      >
        <span
          className="relative block max-h-[640px] min-h-24 overflow-hidden rounded-xl bg-muted transition-[filter] duration-200 group-hover/item:brightness-110"
          style={{ aspectRatio: ratio }}
        >
          <MediaThumb id={file.id} hasThumb={file.hasThumb} />
          {isVideo(file) && (
            <DurationBadge durationMs={file.durationMs} className="absolute bottom-2.5 left-2.5" />
          )}
        </span>
        <span className="flex justify-between gap-2 px-0.5 pt-2 text-xs">
          <span className="truncate text-[#d6d8dd]" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground">{formatBytes(file.size)}</span>
        </span>
      </button>
    </ItemWithMenu>
  );
}
