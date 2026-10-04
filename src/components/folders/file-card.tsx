"use client";

import { DownloadIcon, ImageIcon, PencilIcon, PlayIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { FileItem } from "@/server/queries";
import { ItemWithMenu, type MenuAction } from "./item-menu";

export const contentUrl = (id: string) => `/api/files/${id}/content`;
export const downloadUrl = (id: string) => `/api/files/${id}/content?download=1`;

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
  const [thumbFailed, setThumbFailed] = useState(false);
  const isVideo = file.mimeType.startsWith("video/");

  const actions: MenuAction[] = [
    { label: "Tải về", icon: DownloadIcon, onClick: () => window.location.assign(downloadUrl(file.id)) },
  ];
  if (onRename) actions.push({ label: "Đổi tên", icon: PencilIcon, onClick: onRename });
  if (onDelete) {
    actions.push({ label: "Xoá", icon: Trash2Icon, onClick: onDelete, destructive: true });
  }

  const FallbackIcon = isVideo ? VideoIcon : ImageIcon;

  return (
    <ItemWithMenu actions={actions} className="group/item relative">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative flex aspect-square items-center justify-center bg-muted">
          {file.hasThumb && !thumbFailed ? (
            // Plain <img>: the source is a redirect to a signed R2 URL, nothing to optimize.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${file.id}/thumb`}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setThumbFailed(true)}
              className="size-full object-cover transition-transform group-hover/item:scale-[1.02]"
            />
          ) : (
            <FallbackIcon className="size-10 text-muted-foreground" />
          )}
          {isVideo && (
            <span className="absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
              <PlayIcon className="size-3.5 fill-current" />
            </span>
          )}
        </div>
        <div className="space-y-0.5 p-2.5">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
      </button>
    </ItemWithMenu>
  );
}
