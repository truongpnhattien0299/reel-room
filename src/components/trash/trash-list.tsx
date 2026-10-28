"use client";

import { FolderIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
import { DurationBadge, MediaThumb } from "@/components/folders/media-thumb";
import { SelectionToolbar } from "@/components/folders/selection-toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes, formatRelative } from "@/lib/format";
import { mediaKind } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { purgeTrashItems, restoreTrashItems } from "@/server/actions";
import type { TrashItem } from "@/server/queries";

const keyOf = (item: TrashItem) => `${item.kind}-${item.id}`;
const refOf = (item: TrashItem) => ({ kind: item.kind, id: item.id });

function purgeDescription(items: TrashItem[]) {
  if (items.length === 1) {
    return items[0].kind === "folder"
      ? "Folder, mọi folder con và toàn bộ file bên trong sẽ bị xoá khỏi hệ thống. Không thể hoàn tác."
      : "File sẽ bị xoá khỏi hệ thống. Không thể hoàn tác.";
  }
  const folderCount = items.filter((i) => i.kind === "folder").length;
  const parts = [
    folderCount && `${folderCount} folder (cùng mọi thứ bên trong)`,
    items.length - folderCount && `${items.length - folderCount} file`,
  ].filter(Boolean);
  return `Gồm ${parts.join(" và ")}. Không thể hoàn tác.`;
}

export function TrashList({ items }: { items: TrashItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState<TrashItem[] | null>(null);
  const [, startRestore] = useTransition();
  const lastClicked = useRef<string | null>(null);

  const manageable = items.filter((i) => i.canManage);
  // Items that left the trash (restored or purged) drop out of the selection.
  const picked = manageable.filter((i) => selected.has(keyOf(i)));
  const allPicked = manageable.length > 0 && picked.length === manageable.length;

  /** Click toggles one item; Shift + click picks every manageable item from the last click. */
  function pick(item: TrashItem, range: boolean) {
    const key = keyOf(item);
    const from = range && lastClicked.current ? items.findIndex((i) => keyOf(i) === lastClicked.current) : -1;
    const to = items.indexOf(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (from !== -1) {
        for (const i of items.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          if (i.canManage) next.add(keyOf(i));
        }
      } else if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    lastClicked.current = key;
  }

  function clearSelection() {
    setSelected(new Set());
    lastClicked.current = null;
  }

  const selecting = picked.length > 0;
  useEffect(() => {
    if (!selecting || purging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if (e.key.toLowerCase() === "a" && (e.metaKey || e.ctrlKey) && !typing) {
        e.preventDefault();
        setSelected(new Set(manageable.map(keyOf)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, purging, manageable]);

  function restorePicked() {
    const batch = picked;
    startRestore(async () => {
      const res = await restoreTrashItems(batch.map(refOf));
      if (res.error) toast.error(res.error);
      else {
        toast.success(batch.length === 1 ? `Đã khôi phục “${batch[0].name}”` : `Đã khôi phục ${batch.length} mục`);
        clearSelection();
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-4">
          <Checkbox
            aria-label="Chọn tất cả"
            checked={allPicked}
            indeterminate={selecting && !allPicked}
            disabled={manageable.length === 0}
            onCheckedChange={() => (allPicked ? clearSelection() : setSelected(new Set(manageable.map(keyOf))))}
          />
          <span className="text-sm text-muted-foreground">
            {selecting ? `Đã chọn ${picked.length} / ${items.length} mục` : `${items.length} mục`}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-[#1f2229] overflow-hidden rounded-[18px] bg-card ring-1 ring-border">
          {items.map((item) => (
            <TrashRow
              key={keyOf(item)}
              item={item}
              selected={selected.has(keyOf(item))}
              selecting={selecting}
              onPick={(range) => pick(item, range)}
              onPurge={() => setPurging([item])}
            />
          ))}
        </ul>
      </div>
      {selecting && (
        <SelectionToolbar
          count={picked.length}
          label="Mục đã chọn"
          exitLabel="Bỏ chọn"
          onExit={clearSelection}
          actions={[
            { label: "Khôi phục", icon: RotateCcwIcon, primary: true, onClick: restorePicked },
            {
              label: "Xoá vĩnh viễn",
              icon: Trash2Icon,
              destructive: true,
              primary: true,
              onClick: () => setPurging(picked),
            },
          ]}
        />
      )}
      {purging && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPurging(null)}
          title={purging.length === 1 ? `Xoá vĩnh viễn “${purging[0].name}”?` : `Xoá vĩnh viễn ${purging.length} mục?`}
          description={purgeDescription(purging)}
          confirmLabel="Xoá vĩnh viễn"
          onConfirm={async () => {
            const res = await purgeTrashItems(purging.map(refOf));
            if (!res.error) {
              toast.success(
                purging.length === 1 ? `Đã xoá vĩnh viễn “${purging[0].name}”` : `Đã xoá vĩnh viễn ${purging.length} mục`,
              );
              setSelected((prev) => new Set([...prev].filter((k) => !purging.some((i) => keyOf(i) === k))));
            }
            return res;
          }}
        />
      )}
    </>
  );
}

function TrashRow({
  item,
  selected,
  selecting,
  onPick,
  onPurge,
}: {
  item: TrashItem;
  selected: boolean;
  /** Something is picked: clicking the row toggles it. */
  selecting: boolean;
  onPick: (range: boolean) => void;
  onPurge: () => void;
}) {
  const kind = item.mimeType ? mediaKind({ mimeType: item.mimeType }) : undefined;
  const [pending, startTransition] = useTransition();

  const meta = [
    item.kind === "folder" ? "Folder" : item.size !== undefined && formatBytes(item.size),
    item.location && `từ ${item.location}`,
    `xoá ${formatRelative(item.deletedAt)}${item.deletedByName ? ` bởi ${item.deletedByName}` : ""}`,
    !item.canManage && "chỉ owner mới khôi phục hoặc xoá được",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap",
        selected && "bg-primary/10",
        selecting && item.canManage && "cursor-pointer",
      )}
      // Shift + click picks a range; don't let it select the text in between.
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      onClick={(e) => {
        if (!selecting || !item.canManage) return;
        if ((e.target as HTMLElement).closest("button, [data-slot=checkbox]")) return;
        onPick(e.shiftKey);
      }}
    >
      <Checkbox
        aria-label={`Chọn ${item.name}`}
        checked={selected}
        disabled={!item.canManage}
        onCheckedChange={(_, details) => onPick("shiftKey" in details.event && Boolean(details.event.shiftKey))}
      />
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
            <MediaThumb id={item.id} hasThumb={item.hasThumb ?? false} kind={kind} />
            {kind && kind !== "image" && (
              <DurationBadge durationMs={null} kind={kind} className="absolute bottom-1 left-1 scale-90" />
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
          disabled={pending || !item.canManage}
          onClick={() =>
            startTransition(async () => {
              const res = await restoreTrashItems([refOf(item)]);
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
          disabled={pending || !item.canManage}
          onClick={onPurge}
        >
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}
