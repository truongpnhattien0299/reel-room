"use client";

import { FolderIcon, PencilIcon, Trash2Icon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { ItemWithMenu, type MenuAction } from "./item-menu";

export type FolderCardActions = {
  onRename?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

export function FolderCard({
  folder,
  onRename,
  onShare,
  onDelete,
}: { folder: { id: string; name: string } } & FolderCardActions) {
  const actions: MenuAction[] = [];
  if (onRename) actions.push({ label: "Đổi tên", icon: PencilIcon, onClick: onRename });
  if (onShare) actions.push({ label: "Chia sẻ", icon: UsersIcon, onClick: onShare });
  if (onDelete) {
    actions.push({ label: "Xoá", icon: Trash2Icon, onClick: onDelete, destructive: true });
  }

  return (
    <ItemWithMenu actions={actions} className="group/item relative">
      <Link
        href={`/f/${folder.id}`}
        className="flex items-center gap-3 rounded-xl bg-card p-3 pr-12 ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FolderIcon className="size-5 shrink-0 fill-amber-400/30 text-amber-500" />
        <span className="truncate font-medium" title={folder.name}>
          {folder.name}
        </span>
      </Link>
    </ItemWithMenu>
  );
}
