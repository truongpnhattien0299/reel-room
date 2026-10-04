"use client";

import { CheckIcon, DownloadIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { isVideo } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/server/queries";
import { ItemWithMenu, type MenuAction } from "./item-menu";
import { DurationBadge, MediaThumb } from "./media-thumb";
import { useMediaUrls } from "./media-urls";

/**
 * Masonry tile: keeps the media's own aspect ratio when we know it. With
 * `selected` set the grid is picking files: a click toggles instead of opening.
 */
export function FileCard({
  file,
  selected,
  onOpen,
  onRename,
  onDelete,
}: {
  file: FileItem;
  selected?: boolean;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const urls = useMediaUrls();
  const selecting = selected !== undefined;
  const actions: MenuAction[] = [];
  if (!selecting) {
    actions.push({ label: "Tải về", icon: DownloadIcon, onClick: () => window.location.assign(urls.download(file.id)) });
    if (onRename) actions.push({ label: "Đổi tên", icon: PencilIcon, onClick: onRename });
    if (onDelete) {
      actions.push({ label: "Xoá", icon: Trash2Icon, onClick: onDelete, destructive: true });
    }
  }

  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : "1 / 1";

  return (
    <ItemWithMenu actions={actions} className="group/item relative mb-3.5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={selecting ? `Chọn ${file.name}` : `Xem ${file.name}`}
        aria-pressed={selected}
        className="block w-full text-left outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-ring"
      >
        <span
          className={cn(
            "relative block max-h-[640px] min-h-24 overflow-hidden rounded-xl bg-muted transition-[filter,box-shadow] duration-200 group-hover/item:brightness-110",
            selected && "ring-[3px] ring-primary",
          )}
          style={{ aspectRatio: ratio }}
        >
          <MediaThumb
            id={file.id}
            hasThumb={file.hasThumb}
            className={cn("transition-transform duration-200", selected && "scale-[0.94] rounded-lg")}
          />
          {selecting && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded-full ring-2 backdrop-blur-sm transition-colors",
                selected
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-stage/50 ring-white/70",
              )}
            >
              {selected && <CheckIcon className="size-4" strokeWidth={3} />}
            </span>
          )}
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
