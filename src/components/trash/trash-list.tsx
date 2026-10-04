"use client";

import { FolderIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
import { DurationBadge, MediaThumb } from "@/components/folders/media-thumb";
import { Button } from "@/components/ui/button";
import { formatBytes, formatRelative } from "@/lib/format";
import { isVideo } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { purgeFile, purgeFolder, restoreFile, restoreFolder } from "@/server/actions";
import type { TrashItem } from "@/server/queries";

export function TrashList({ items }: { items: TrashItem[] }) {
  const [purging, setPurging] = useState<TrashItem | null>(null);

  return (
    <>
      <ul className="flex flex-col divide-y divide-[#1f2229] overflow-hidden rounded-[18px] bg-card ring-1 ring-border">
        {items.map((item) => (
          <TrashRow
            key={`${item.kind}-${item.id}`}
            item={item}
            onPurge={() => setPurging(item)}
          />
        ))}
      </ul>
      {purging && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPurging(null)}
          title={`Xoá vĩnh viễn “${purging.name}”?`}
          description={
            purging.kind === "folder"
              ? "Folder, mọi folder con và toàn bộ ảnh, video bên trong sẽ bị xoá khỏi hệ thống. Không thể hoàn tác."
              : "File sẽ bị xoá khỏi hệ thống. Không thể hoàn tác."
          }
          confirmLabel="Xoá vĩnh viễn"
          onConfirm={() =>
            purging.kind === "folder" ? purgeFolder(purging.id) : purgeFile(purging.id)
          }
        />
      )}
    </>
  );
}

function TrashRow({ item, onPurge }: { item: TrashItem; onPurge: () => void }) {
  const [pending, startTransition] = useTransition();

  const meta = [
    item.kind === "folder" ? "Folder" : item.size !== undefined && formatBytes(item.size),
    item.location && `từ ${item.location}`,
    `xoá ${formatRelative(item.deletedAt)}${item.deletedByName ? ` bởi ${item.deletedByName}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap">
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
        {item.kind === "folder" ? (
          <span
            className="flex size-full items-center justify-center"
            style={{ background: toneFor(item.id).sky }}
          >
            <FolderIcon className="size-6 text-white/70" aria-hidden="true" />
          </span>
        ) : (
          <>
            <MediaThumb id={item.id} hasThumb={item.hasThumb ?? false} />
            {item.mimeType && isVideo({ mimeType: item.mimeType }) && (
              <DurationBadge durationMs={null} className="absolute bottom-1 left-1 scale-90" />
            )}
          </>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium" title={item.name}>
          {item.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </div>
      <span className="hidden shrink-0 font-mono text-xs text-muted-foreground md:inline">
        {item.daysLeft === 0 ? "xoá hôm nay" : `còn ${item.daysLeft} ngày`}
      </span>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="lg"
          className="rounded-[10px]"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res =
                item.kind === "folder" ? await restoreFolder(item.id) : await restoreFile(item.id);
              if (res.error) toast.error(res.error);
              else toast.success(`Đã khôi phục “${item.name}”`);
            })
          }
        >
          <RotateCcwIcon data-icon="inline-start" />
          Khôi phục
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Xoá vĩnh viễn ${item.name}`}
          disabled={pending}
          onClick={onPurge}
        >
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}
