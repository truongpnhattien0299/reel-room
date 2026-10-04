"use client";

import { PencilIcon, Trash2Icon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { formatRelative } from "@/lib/format";
import type { FolderStats } from "@/server/queries";
import { ItemWithMenu, type MenuAction } from "./item-menu";
import { MediaThumb, ToneTile } from "./media-thumb";

export type FolderCardActions = {
  onRename?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

type CardFolder = { id: string; name: string } & FolderStats;

function menuActions({ onRename, onShare, onDelete }: FolderCardActions): MenuAction[] {
  const actions: MenuAction[] = [];
  if (onRename) actions.push({ label: "Đổi tên", icon: PencilIcon, onClick: onRename });
  if (onShare) actions.push({ label: "Chia sẻ", icon: UsersIcon, onClick: onShare });
  if (onDelete) {
    actions.push({ label: "Xoá", icon: Trash2Icon, onClick: onDelete, destructive: true });
  }
  return actions;
}

function folderMeta(f: FolderStats) {
  const count = f.itemCount === 0 ? "Trống" : `${f.itemCount} mục`;
  return f.lastUpload ? `${count} · ${formatRelative(f.lastUpload)}` : count;
}

/** Library card: a three-picture cover made from the newest files inside. */
export function FolderCard({ folder, ...actions }: { folder: CardFolder } & FolderCardActions) {
  const [a, b, c] = folder.previewIds;
  return (
    <ItemWithMenu actions={menuActions(actions)} className="group/item relative">
      <Link
        href={`/f/${folder.id}`}
        className="flex flex-col gap-3.5 rounded-[18px] bg-card p-2.5 pb-4 ring-1 ring-border transition-[transform,box-shadow] duration-200 outline-none hover:-translate-y-0.5 hover:ring-[#3a3f4a] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid h-[170px] grid-cols-[2fr_1fr] grid-rows-2 gap-1 overflow-hidden rounded-xl">
          <div className="row-span-2 overflow-hidden">
            {a ? <MediaThumb id={a} hasThumb /> : <ToneTile seed={folder.id} />}
          </div>
          <div className="overflow-hidden">
            {b ? <MediaThumb id={b} hasThumb /> : <ToneTile seed={`${folder.id}-b`} />}
          </div>
          <div className="overflow-hidden">
            {c ? <MediaThumb id={c} hasThumb /> : <ToneTile seed={`${folder.id}-c`} />}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 px-1.5">
          <span className="truncate text-[15px] font-semibold" title={folder.name}>
            {folder.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{folderMeta(folder)}</span>
        </div>
      </Link>
    </ItemWithMenu>
  );
}

/** Compact row card for subfolders inside a folder. */
export function SubfolderCard({ folder, ...actions }: { folder: CardFolder } & FolderCardActions) {
  const cover = folder.previewIds[0];
  return (
    <ItemWithMenu
      actions={menuActions(actions)}
      className="group/item relative"
      menuClassName="top-1/2 right-2.5 -translate-y-1/2"
    >
      <Link
        href={`/f/${folder.id}`}
        className="flex items-center gap-3 rounded-[14px] bg-card py-2.5 pr-12 pl-2.5 ring-1 ring-border transition-colors outline-none hover:bg-[#1a1d23] hover:ring-[#3a3f4a] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="size-11 shrink-0 overflow-hidden rounded-[10px]">
          {cover ? <MediaThumb id={cover} hasThumb /> : <ToneTile seed={folder.id} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="truncate font-semibold" title={folder.name}>
            {folder.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {folder.itemCount === 0 ? "Trống" : `${folder.itemCount} mục`}
          </span>
        </span>
      </Link>
    </ItemWithMenu>
  );
}
